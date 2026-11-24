// XCGlobe Live Tracking API.
//
// https://xcglobe.com/api/partners/v1/live-tracking/positions

import type { protos, TrackerNames } from '@flyxc/common';
import { fetchResponse, formatReqError, parseRetryAfterS, validateFlymeAccount } from '@flyxc/common';

import type { LivePoint } from './live-track';
import { createLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

const POSITIONS_URL = 'https://xcglobe.com/api/partners/v1/live-tracking/positions';

let retryAfterS = 0;

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
    if (devices.length === 0 || Date.now() / 1000 < retryAfterS) {
      return;
    }

    // Fixes are id, lat, lon, alt, timeSec and username.
    const flymeIdToFix = new Map<number, [number, number, number, number, number, string]>();

    try {
      const response = await fetchResponse(POSITIONS_URL, {
        timeoutS: 10,
        returnOnStatus: [503],
        headers: {
          Authorization: `Bearer ${SECRETS.FLYME_TOKEN}`,
          Accept: 'application/json',
        },
      });
      if (response.ok) {
        try {
          const fixes = await response.json();
          if (Array.isArray(fixes)) {
            fixes.forEach((fix: [number, number, number, number, number, string]) => {
              const id = fix[0];
              flymeIdToFix.set(id, fix);
            });
          }
          devices.forEach((id) => updates.fetchedTracker.add(id));
        } catch (e) {
          updates.errors.push(`Error parsing JSON ${response.body}\n${e}`);
        }
      } else {
        if (response.status === 429 || response.status === 503) {
          retryAfterS = parseRetryAfterS(response.headers.get('Retry-After'), 0);
        }
        // Cancel the unconsumed response body to immediately release the underlying socket back to the connection pool.
        await response.body?.cancel();
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
            lat: fix[1],
            lon: fix[2],
            alt: fix[3],
            timeSec: fix[4],
          },
        ];
        updates.trackerDeltas.set(id, createLiveTrack(livePoints, this.getTrackerName()).track);
      }
    }
  }
}
