// XCGlobe Flyme tracker API.
//
// http://xcglobe.com/flyme/

import type { protos, TrackerNames } from '@flyxc/common';
import { fetchResponse, formatReqError, SecretKeys, validateFlymeAccount } from '@flyxc/common';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

export class FlymeFetcher extends TrackerFetcher {
  protected getTrackerName(): TrackerNames {
    return 'flyme';
  }

  // All trackers are retrieved at once anyway.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    // Fixes are id, lat, lon, alt, timeSec and username.
    const flymeIdToFix = new Map<number, [number, number, number, number, number, string]>();
    const url = `https://xcglobe.com/livetrack/flyxcPositions?token=${SecretKeys.FLYME_TOKEN}`;

    try {
      const response = await fetchResponse(url, { timeoutS: 10 });
      if (response.ok) {
        try {
          const fixes = await response.json();
          fixes.forEach((fix: [number, number, number, number, number, string]) => {
            const id = fix[0];
            flymeIdToFix.set(id, fix);
          });
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
      if (validateFlymeAccount(tracker.account) === false) {
        updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
        continue;
      }
      const fix = flymeIdToFix.get(Number(tracker.account));
      if (fix) {
        const livePoints: LivePoint[] = [
          {
            name: 'flyme',
            lat: fix[1],
            lon: fix[2],
            alt: fix[3],
            timeMs: fix[4] * 1000,
          },
        ];
        updates.trackerDeltas.set(id, makeLiveTrack(livePoints));
      }
    }
  }
}
