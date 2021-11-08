// InReach tracker API.
//
// See https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8.

import { Tracker } from 'flyxc/common/protos/fetcher-state';
import { LIVE_MINIMAL_INTERVAL_SEC, simplifyLiveTrack, TrackerIds } from 'flyxc/common/src/live-track';
import { validateInreachAccount } from 'flyxc/common/src/models';
import { formatReqError, parallelTasksWithTimeout } from 'flyxc/common/src/util';
import { DOMParser } from 'xmldom';

import { LivePoint, makeLiveTrack } from './live-track';
import { getTextRetry } from './superagent';
import { TrackerFetcher, TrackerUpdates } from './tracker';

export class InreachFetcher extends TrackerFetcher {
  protected getTrackerId(): TrackerIds {
    return TrackerIds.Inreach;
  }

  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const fetchSingle = async (id: number) => {
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
        const response = await getTextRetry(url);
        if (response.ok) {
          try {
            const points = parse(response.body);
            const track = makeLiveTrack(points);
            simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
            if (track.timeSec.length > 0) {
              updates.trackerDeltas.set(id, track);
            }
          } catch (e) {
            updates.trackerErrors.set(id, `Error parsing the kml for ${id}\n${e}`);
          }
        } else {
          updates.trackerErrors.set(id, `HTTP Status = ${response.status} for ${url}`);
        }
      } catch (e) {
        updates.trackerErrors.set(id, `Error ${formatReqError(e)} for url ${url}`);
      }
    };

    const { isTimeout } = await parallelTasksWithTimeout(4, devices, fetchSingle, timeoutSec * 1000);

    if (isTimeout) {
      updates.errors.push(`Fetch timeout`);
    }
  }

  // Introduce some spread to avoid congested ticks.
  protected getNextFetchAfterSec(tracker: Readonly<Tracker>): number {
    if (tracker.numConsecutiveErrors > 30) {
      return 24 * 3600;
    }
    if (tracker.numConsecutiveErrors > 20) {
      return 3600;
    }
    if (tracker.numConsecutiveErrors > 10) {
      return 10 * 60;
    }
    const lastFixAgeSec = Math.round(Date.now() / 1000) - tracker.lastFixSec;
    if (lastFixAgeSec > 3 * 30 * 24 * 3600) {
      return 20 * 60;
    }
    if (lastFixAgeSec > 3 * 3600) {
      return Math.floor(9 + Math.random() * 3) * 60;
    }
    if (lastFixAgeSec > 1800) {
      return Math.floor(3 + Math.random() * 3) * 60;
    }
    return 60;
  }
}

// Parses the kml feed to a list of `LivePoint`s.
//
// Throws an `Error` on invalid feed.
export function parse(kmlFeed: string): LivePoint[] {
  const points: LivePoint[] = [];

  if (kmlFeed.length == 0) {
    return points;
  }
  const parser = new DOMParser({
    errorHandler: (level: string, msg: string): void => {
      if (/error/i.test(level)) {
        throw new Error(`Invalid InReach feed (${msg}) - feed: ${kmlFeed}`);
      }
    },
  });

  const placemarks = parser.parseFromString(kmlFeed).getElementsByTagName('Placemark');

  for (let p = 0; p < placemarks.length; p++) {
    const placemark = placemarks[p];
    const coordinates = getChildNode(placemark.childNodes, 'Point.coordinates')?.firstChild?.nodeValue;
    const time = getChildNode(placemark.childNodes, 'TimeStamp.when')?.firstChild?.nodeValue;
    const extendedDataNode = getChildNode(placemark.childNodes, 'ExtendedData');
    const extendedData = extendedDataNode ? getExtendedDataMap(extendedDataNode) : null;
    const message = getChildNode(placemark.childNodes, 'description')?.firstChild?.nodeValue;

    if (coordinates && time && extendedData) {
      const [lon, lat, alt] = coordinates
        .trim()
        .split(',')
        .map((v: string) => Number(v));

      points.push({
        device: TrackerIds.Inreach,
        lon,
        lat,
        alt: Math.round(alt),
        timestamp: new Date(time).getTime(),
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
function getChildNode(nodeList: NodeListOf<ChildNode>, tagPath: string): ChildNode | null {
  const tagName = tagPath.split('.')[0];
  for (let i = 0; i < nodeList.length; i++) {
    const el = nodeList[i] as Element;
    if (el.tagName == tagName) {
      if (tagName == tagPath) {
        return el;
      }
      return getChildNode(nodeList[i].childNodes, tagPath.substr(tagName.length + 1));
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
