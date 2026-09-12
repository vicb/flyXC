// InReach tracker API.
//
// See
// - https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8 (offline)
// - https://web.archive.org/web/20230328084014/https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8

import type { protos, TrackerNames } from '@flyxc/common';
import {
  fetchResponse,
  formatReqError,
  Keys,
  LiveDataIntervalSec,
  parallelTasksWithTimeout,
  parseRetryAfterS,
  simplifyLiveTrack,
  validateInreachAccount,
} from '@flyxc/common';
import { createXmlParser, pushListCap, sanitizeXmlInput } from '@flyxc/common-node';
import { fetch as undiciFetch } from 'undici';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import { Proxy } from './proxy';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

// Local state
let useProxyUntilS = 0;
let checkProxyZombiesAfterS = 0;
const CHECK_ZOMBIES_EVERY_MIN = 20;
const proxies = new Proxy('inreach');

export class InreachFetcher extends TrackerFetcher {
  protected getTrackerName(): TrackerNames {
    return 'inreach';
  }

  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const useProxy = Date.now() / 1000 < useProxyUntilS;
    let isRateLimited = false;
    let fetchTrackers = true;

    if (useProxy) {
      fetchTrackers = await proxies.isReadyOrStart();
      if (!fetchTrackers) {
        updates.errors.push('Proxy unreachable');
      }
    } else if (proxies.detachCurrent()) {
      // When no longer rate-limited, detach the active proxy and trigger immediate
      // zombie cleanup to terminate the unused GCE VM.
      checkProxyZombiesAfterS = 0;
    }

    if (fetchTrackers) {
      const fetchSingle = async (id: number): Promise<void> => {
        if (isRateLimited) {
          return;
        }

        const tracker = this.getTracker(id);
        if (tracker == null) {
          return;
        }
        if (validateInreachAccount(tracker.account) === false) {
          updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
          return;
        }

        const fetchFromSec = this.getTrackerFetchFromSec(id, updates.startFetchSec, 2 * 3600);
        const url = `${tracker.account}?d1=${new Date(fetchFromSec * 1000).toISOString()}`;

        try {
          updates.fetchedTracker.add(id);
          const dispatcher = useProxy ? proxies.getDispatcher() : undefined;

          // When routing via proxy dispatcher, use Undici's own `fetch` instead of Node's `globalThis.fetch`.
          // Node embeds its own internal copy of Undici which can drift in major versions from the npm `undici`
          // package (e.g. when Node is upgraded in Docker while dependencies are pinned, or vice-versa).
          // Since both `undici.fetch` and `ProxyAgent` originate from the exact same npm package, their internal
          // dispatcher interface (e.g. `onRequestStart`) is guaranteed to match regardless of the host Node version.
          const response = await fetchResponse(url, {
            retry: 1,
            timeoutS: 8,
            dispatcher,
            fetch: dispatcher ? (undiciFetch as any) : undefined,
          });
          if (response.ok) {
            try {
              const points = parse(await response.text());
              const track = makeLiveTrack(points, this.getTrackerName());
              simplifyLiveTrack(track, LiveDataIntervalSec.Recent);
              if (track.timeSec.length > 0) {
                updates.trackerDeltas.set(id, track);
              }
            } catch (e) {
              updates.trackerErrors.set(id, `Error parsing the kml for ${id}\n${e}`);
            }
          } else {
            // Cancel the unconsumed response body to immediately release the underlying socket back to the connection pool.
            await response.body?.cancel();
            updates.trackerErrors.set(id, `HTTP Status = ${response.status} for ${url}`);
            if (response.status == 429) {
              if (!isRateLimited && !useProxy) {
                // Only update `proxyUntilS` for the main server.
                useProxyUntilS = parseRetryAfterS(response.headers.get('Retry-After') ?? '600');
              }
              isRateLimited = true;
              return;
            }
          }
        } catch (e) {
          updates.trackerErrors.set(id, `Error ${formatReqError(e)} for url ${url}`);
        }
      };

      const { isTimeout } = await parallelTasksWithTimeout(4, devices, fetchSingle, timeoutSec * 1000);

      if (isTimeout) {
        updates.errors.push(`Fetch timeout`);
      }

      if (isRateLimited) {
        // Start another proxy when the current server is rate-limited.
        proxies.start();
        checkProxyZombiesAfterS = 0;
      }
    }

    if (Date.now() / 1000 > checkProxyZombiesAfterS) {
      checkProxyZombiesAfterS = Date.now() / 1000 + CHECK_ZOMBIES_EVERY_MIN * 60;
      proxies.killZombies().then((success) => {
        if (!success) {
          checkProxyZombiesAfterS = 0;
        }
      });
    }

    pushListCap(this.pipeline, Keys.proxyInreach, proxies.flushLogs(), 20);
  }

  // Introduce some spread to avoid congested ticks.
  protected getNextFetchAfterSec(tracker: Readonly<protos.Tracker>): number {
    if (tracker.numConsecutiveErrors > 30) {
      return 24 * 3600;
    }
    if (tracker.numConsecutiveErrors > 20) {
      return 3600;
    }
    if (tracker.numConsecutiveErrors > 10) {
      return 10 * 60;
    }
    if (tracker.numConsecutiveErrors == 1 || tracker.numConsecutiveErrors == 2) {
      // Retry fast on few errors.
      return 60;
    }
    const lastFixAgeSec = Math.round(Date.now() / 1000) - tracker.lastFixSec;
    if (lastFixAgeSec > 6 * 30 * 24 * 3600) {
      return Math.floor(55 + Math.random() * 10) * 60;
    }
    if (lastFixAgeSec > 3 * 30 * 24 * 3600) {
      return Math.floor(35 + Math.random() * 5) * 60;
    }
    if (lastFixAgeSec > 3 * 3600) {
      return Math.floor(20 + Math.random() * 3) * 60;
    }
    if (lastFixAgeSec > 30 * 60) {
      return Math.floor(8 + Math.random() * 3) * 60;
    }
    return 4 * 60;
  }
}

// Parses the kml feed to a list of `LivePoint`s.
//
// Throws an `Error` on invalid feed.
export function parse(kmlFeed: string): LivePoint[] {
  const points: LivePoint[] = [];

  const sanitized = sanitizeXmlInput(kmlFeed);
  if (sanitized.length === 0) {
    return points;
  }
  const parser = createXmlParser({
    onError: (level: string, msg: string): void => {
      if (/error/i.test(level)) {
        throw new Error(`Invalid InReach feed (${msg}) - feed: ${kmlFeed}`);
      }
    },
  });

  const placemarks = parser.parseFromString(sanitized, 'text/xml').getElementsByTagName('Placemark');

  for (let p = 0; p < placemarks.length; p++) {
    const placemark = placemarks[p];
    const coordinates = getChildNode(placemark.childNodes, 'Point.coordinates')?.firstChild?.nodeValue;
    const time = getChildNode(placemark.childNodes, 'TimeStamp.when')?.firstChild?.nodeValue;
    const extendedDataNode = getChildNode(placemark.childNodes, 'ExtendedData');
    const extendedData = extendedDataNode ? getExtendedDataMap(extendedDataNode) : null;
    const message = getChildNode(placemark.childNodes, 'description')?.firstChild?.nodeValue;

    if (coordinates && time && extendedData) {
      if (extendedData['Event'] === 'Reference Point message received.') {
        // The coordinates correspond to a waypoint received by the device.
        continue;
      }

      const [lon, lat, alt] = coordinates
        .trim()
        .split(',')
        .map((v: string) => Number(v));

      points.push({
        lon,
        lat,
        alt: Math.round(alt),
        timeMs: new Date(time).getTime(),
        message,
        speed: Number(extendedData['Velocity'].replace(/^([\d]+).*/, '$1')),
        emergency: extendedData['In Emergency'] !== 'False',
        valid: extendedData['Valid GPS Fix'] === 'True',
      });
    }
  }

  return points;
}

// Returns a child node by "." delimited path.
function getChildNode(nodeList: ArrayLike<any>, tagPath: string): ChildNode | null {
  const tagName = tagPath.split('.')[0];
  for (let i = 0; i < nodeList.length; i++) {
    const el = nodeList[i] as Element;
    if (el.tagName == tagName) {
      if (tagName == tagPath) {
        return el;
      }
      return getChildNode(nodeList[i].childNodes, tagPath.substring(tagName.length + 1));
    }
  }
  return null;
}

// Returns the ExtendedData node as a key-value list.
function getExtendedDataMap(extendedData: ChildNode): { [k: string]: string } {
  const data: { [k: string]: string } = {};
  const childNodes = extendedData?.childNodes || [];
  for (let d = 0; d < childNodes.length; d++) {
    const el = childNodes[d] as Element;
    if (el.tagName == 'Data' && el.childNodes) {
      const id = el.getAttribute('name');
      if (id != null) {
        const value = getChildNode(el.childNodes, 'value')?.firstChild?.nodeValue;
        data[id] = value ?? '';
      }
    }
  }
  return data;
}
