// XContest API
//
// https://live.xcontest.org/

import type { protos, TrackerNames } from '@flyxc/common';
import {
  fetchResponse,
  formatReqError,
  LIVE_TRACKER_RETENTION_SEC,
  parallelTasksWithTimeout,
  validateXContestAccount,
} from '@flyxc/common';
import { Secrets } from '@flyxc/secrets';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

// duration to fetch
const FETCH_MS = 4 * 60 * 1000;

export interface XContestFlight {
  lastTimeMs: number;
  uuid: string;
}

export class XcontestFetcher extends TrackerFetcher {
  protected getTrackerName(): TrackerNames {
    return 'xcontest';
  }

  // All trackers are retrieved at once anyway.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const xcontestIdToLastFlight = new Map<string, XContestFlight>();

    // Get all the users for the retention period
    const openTimeMs = new Date().getTime() - LIVE_TRACKER_RETENTION_SEC * 1000;

    const liveUserUrl =
      `https://api.xcontest.org/livedata/users?entity=group:flyxc&source=live&opentime={openTimeISO}`.replace(
        '{openTimeISO}',
        new Date(openTimeMs).toISOString(),
      );

    try {
      const response = await fetchResponse(liveUserUrl, {
        timeoutS: 30,
        headers: { Authorization: `Bearer ${Secrets.XCONTEXT_JWT}` },
      });
      if (response.ok) {
        try {
          const users = await response.json();
          const keepFromMs = new Date().getTime() - FETCH_MS * 60 * 1000;
          parseLiveUsers(users, xcontestIdToLastFlight, keepFromMs);
        } catch (e) {
          updates.errors.push(`Error parsing JSON ${response.body}\n${e}`);
        }
      } else {
        updates.errors.push(`HTTP status ${response.status}`);
      }
    } catch (e) {
      updates.errors.push(`Error ${formatReqError(e)}`);
    }

    const fetchTimeMs = new Date().getTime();
    const fetchFromMs = fetchTimeMs - FETCH_MS;
    const deviceIdToXContestId = new Map<number, string>();

    for (const id of devices) {
      const tracker = this.getTracker(id);
      if (tracker == null) {
        continue;
      }
      if (validateXContestAccount(tracker.account) === false) {
        updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
        continue;
      }
      const flight = xcontestIdToLastFlight.get(tracker.account);
      if (flight == null) {
        continue;
      }
      if (flight.lastTimeMs > fetchFromMs) {
        deviceIdToXContestId.set(id, tracker.account);
      }
    }

    const fetchDevices = [...deviceIdToXContestId.keys()];
    const liveTrackUrl = `https://api.xcontest.org/livedata/track?entity=group:flyxc&flight={flightUuid}&lastfixtime={lastFixISO}`;

    const fetchTrack = async (deviceId: number) => {
      try {
        const userId = deviceIdToXContestId.get(deviceId);
        const flightId = xcontestIdToLastFlight.get(userId).uuid;
        const fetchFromSec = this.getTrackerFetchFromSec(deviceId, updates.startFetchSec, FETCH_MS / 1000);
        const url = liveTrackUrl
          .replace('{lastFixISO}', new Date(fetchFromSec * 1000).toISOString())
          .replace('{flightUuid}', flightId);
        const response = await fetchResponse(url, {
          timeoutS: 10,
          headers: { Authorization: `Bearer ${Secrets.XCONTEXT_JWT}` },
        });
        if (response.ok) {
          try {
            const track = await response.json();
            const points = parseLiveTrack(track);
            updates.fetchedTracker.add(deviceId);
            if (points.length > 0) {
              updates.trackerDeltas.set(deviceId, makeLiveTrack(points));
            }
          } catch (e) {
            updates.trackerErrors.set(deviceId, `Error parsing JSON ${response.body}\n${e}`);
          }
        } else {
          updates.trackerErrors.set(deviceId, `HTTP status ${response.status}`);
        }
      } catch (e) {
        updates.trackerErrors.set(deviceId, `Error ${formatReqError(e)}`);
      }
    };

    const { isTimeout } = await parallelTasksWithTimeout(4, fetchDevices, fetchTrack, timeoutSec * 1000);

    if (isTimeout) {
      updates.errors.push(`Fetch timeout`);
    }
  }
}

export function parseLiveUsers(users: any, idToLastFlight: Map<string, XContestFlight>, keepFromMs: number) {
  for (const [userUuid, data] of Object.entries(users.users)) {
    if (Array.isArray((data as any).flights) && (data as any).flights.length > 0) {
      const flight = (data as any).flights.at(-1);
      const [_lon, _lat, _alt, details] = flight.lastFix;
      const timeMs = new Date(details.t).getTime();
      if (timeMs > keepFromMs) {
        idToLastFlight.set(userUuid, {
          lastTimeMs: timeMs,
          uuid: flight.uuid,
        });
      }
    }
  }
}

export function parseLiveTrack(track: any) {
  const points: LivePoint[] = [];
  let timeMs = new Date(track.flight.properties.firstFixTime).getTime();
  for (const fix of track.flight.geometry.coordinates) {
    const [lon, lat, alt, details] = fix;
    timeMs += (details?.dt ?? 1) * 1000;
    points.push({ lat, lon, alt, timeMs, name: 'xcontest' });
  }
  return points;
}
