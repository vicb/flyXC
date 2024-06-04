// Flymaster.
//
// https://lt.flymaster.net/wlb/?

import type { protos, TrackerNames } from '@flyxc/common';
import {
  fetchResponse,
  formatReqError,
  LIVE_MINIMAL_INTERVAL_SEC,
  removeBeforeFromLiveTrack,
  SecretKeys,
  simplifyLiveTrack,
  validateFlymasterAccount,
} from '@flyxc/common';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

// Latency before a fix is available (usually ~4min).
const FLYMASTER_LATENCY_SEC = 5 * 60;

export class FlymasterFetcher extends TrackerFetcher {
  protected getTrackerName(): TrackerNames {
    return 'flymaster';
  }

  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const deadlineMs = Date.now() + timeoutSec * 1000;

    while (devices.length > 0) {
      // Flymaster id to Datastore id.
      const flmIdToDsId = new Map<number, number>();
      // Retrieve positions from at least 5min ago (system latency).
      const fetchSecond = updates.startFetchSec - FLYMASTER_LATENCY_SEC;
      const trackersParam: { [id: string]: number } = {};

      // Fetch up to 10 devices at once.
      for (const dsId of devices.splice(0, 10)) {
        const tracker = this.getTracker(dsId);
        if (tracker == null) {
          continue;
        }
        if (validateFlymasterAccount(tracker.account) === false) {
          updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
          continue;
        }
        const flmId = Number(tracker.account);
        flmIdToDsId.set(flmId, dsId);
        trackersParam[String(flmId)] = fetchSecond;
      }

      let flights: { [id: string]: any } = {};
      const url = `https://lt.flymaster.net/wlb/getLiveData.php?grp=${SecretKeys.FLYMASTER_GROUP_ID}&token=${
        SecretKeys.FLYMASTER_GROUP_TOKEN
      }&trackers=${JSON.stringify(trackersParam)}`;

      try {
        const response = await fetchResponse(url);
        if (response.ok) {
          try {
            flights = await response.json();
            [...flmIdToDsId.values()].forEach((id) => updates.fetchedTracker.add(id));
          } catch (e) {
            updates.errors.push(`Error parsing the json for ${url}\n${e}`);
          }
        } else {
          updates.errors.push(`HTTP Status = ${response.status} for ${url}`);
        }
      } catch (e) {
        updates.errors.push(`Error ${formatReqError(e)} for url ${url}`);
      }

      Object.entries(flights).forEach(([id, flight]) => {
        const flmId = Number(id);
        const dsId = flmIdToDsId.get(flmId) as number;
        // Get an extra 5min of data that might not have been received (when no network coverage).
        const points = parse(flight);
        let track = makeLiveTrack(points);
        track = removeBeforeFromLiveTrack(track, fetchSecond - 300);
        simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
        updates.trackerDeltas.set(dsId, track);
      });

      if (Date.now() >= deadlineMs) {
        updates.errors.push(`Fetch timeout`);
        break;
      }
    }
  }

  protected getNextFetchAfterSec(tracker: Readonly<protos.Tracker>): number {
    const lastFixAgeSec = Math.round(Date.now() / 1000) - tracker.lastFixSec;
    if (lastFixAgeSec > 24 * 3600) {
      return Math.floor(3 + Math.random() * 3) * 60;
    }
    return 60;
  }
}

// Parses a Flymaster flight.
export function parse(flight: any): LivePoint[] {
  return flight.map(
    (fix: any): LivePoint => ({
      name: 'flymaster',
      lat: fix.ai / 60000,
      lon: fix.oi / 60000,
      alt: fix.h,
      gndAlt: fix.s,
      speed: fix.v,
      timeMs: fix.d * 1000,
    }),
  );
}
