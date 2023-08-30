// XContest API
//
// https://live.xcontest.org/

import {
  fetchResponse,
  formatReqError,
  protos,
  SecretKeys,
  TrackerNames,
  validateXContestAccount,
} from '@flyxc/common';
import { LivePoint, makeLiveTrack } from './live-track';
import { TrackerFetcher, TrackerUpdates } from './tracker';

// opentime refers to the start of the track.
const FETCH_TRACK_STARTED_IN_PAST_HOURS = 24;
// but we don't want to keep stale data.
const DISCARD_POSITION_OLDER_THAN_MIN = 30;

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
    const xcontestIdToLivePoint = new Map<string, LivePoint>();

    const openTimeMs = new Date().getTime() - FETCH_TRACK_STARTED_IN_PAST_HOURS * 3600 * 1000;

    const url = `https://api.xcontest.org/livedata/users?entity=group:flyxc&source=live&opentime={openTimeISO}`.replace(
      '{openTimeISO}',
      new Date(openTimeMs).toISOString(),
    );

    try {
      const response = await fetchResponse(url, {
        timeoutS: 30,
        headers: { Authorization: `Bearer ${SecretKeys.XCONTEXT_JWT}` },
      });
      if (response.ok) {
        try {
          const users = await response.json();
          const keepFromMs = new Date().getTime() - DISCARD_POSITION_OLDER_THAN_MIN * 60 * 1000;
          parse(users, xcontestIdToLivePoint, keepFromMs);
          devices.forEach((id) => updates.fetchedTracker.add(id));
        } catch (e) {
          updates.errors.push(`Error parsing JSON ${response.body}\n${e}`);
        }
      } else {
        updates.errors.push(`HTTP status ${response.status}`);
      }
    } catch (e) {
      updates.errors.push(`Error ${formatReqError(e)}`);
    }

    for (const id of devices) {
      const tracker = this.getTracker(id);
      if (tracker == null) {
        continue;
      }
      if (validateXContestAccount(tracker.account) === false) {
        updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
        continue;
      }
      const livePoint = xcontestIdToLivePoint.get(tracker.account);
      if (livePoint) {
        updates.trackerDeltas.set(id, makeLiveTrack([livePoint]));
      }
    }
  }
}

export function parse(users: any, idToLivePoint: Map<string, LivePoint>, keepFromMs: number) {
  for (const [uuid, data] of Object.entries(users.users)) {
    if ((data as any).lastLoc) {
      const [lon, lat, alt, details] = (data as any).lastLoc.geometry.coordinates;
      const timeMs = new Date(details.t).getTime();
      if (timeMs > keepFromMs) {
        idToLivePoint.set(uuid, {
          lat,
          lon,
          alt,
          timeMs,
          name: 'xcontest',
        });
      }
    }
  }
}
