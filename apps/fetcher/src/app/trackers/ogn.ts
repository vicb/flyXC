// OGN API.
//
// See http://wiki.glidernet.org/.

import type { AprsPosition, protos, TrackerNames } from '@flyxc/common';
import { NO_ALTITUDE, parseFntStatus, validateOgnAccount } from '@flyxc/common';
import type { RedisClientMultiCmd } from '@flyxc/common-node';

import type { LivePoint } from './live-track';
import { createLiveTrack } from './live-track';
import type { OgnClient } from './ogn-client';
import { OgnPusher } from './ogn-push';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

// Push positions to OGN.
let ognPusher: OgnPusher | undefined;

export class OgnFetcher extends TrackerFetcher {
  constructor(protected client: OgnClient, state: protos.FetcherState, pipeline: RedisClientMultiCmd) {
    super(state, pipeline);
    if (ognPusher == null) {
      ognPusher = new OgnPusher(this.client, this.state);
    }
  }

  protected getTrackerName(): TrackerNames {
    return 'ogn';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    this.client.maybeConnect();
    const ognIdToDsId = new Map<string, number>();

    ognPusher.registerDsIds(new Set(devices));
    ognPusher.push();

    for (const dsId of devices) {
      const tracker = this.getTracker(dsId);
      if (tracker == null) {
        continue;
      }
      if (validateOgnAccount(tracker.account) === false) {
        updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
        continue;
      }
      const ognId = tracker.account.toUpperCase();
      ognIdToDsId.set(ognId, dsId);
      updates.fetchedTracker.add(dsId);
    }

    this.client.registerOgnIds(new Set(ognIdToDsId.keys()));

    const keepFromSec = Math.round(Date.now() / 1000) - 5 * 60;
    for (const [ognId, positions] of this.client.getAndClearPositions().entries()) {
      const dsId = ognIdToDsId.get(ognId);
      if (dsId == null) {
        continue;
      }

      const pilotTrack = this.state.pilots[dsId]?.track;
      const points = processOgnPositions(positions, keepFromSec, pilotTrack);

      if (points.length > 0) {
        const { track, statusUpdate } = createLiveTrack(points, this.getTrackerName());
        updates.trackerDeltas.set(dsId, track);
        if (statusUpdate) {
          updates.trackerStatus.set(dsId, statusUpdate);
        }
      }
    }

    updates.errors.push(...this.client.getAndClearLogs());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }
}

/**
 * Affinity window (in minutes) to resolve altitude from recent fixes.
 */
export const OGN_ALTITUDE_AFFINITY_MIN = 30;

/**
 * Resolves OGN positions into LivePoints, borrowing altitude from nearby points in the cycle
 * or previous track within the affinity window if altitude is missing (e.g. FANET status beacons).
 * If no altitude is available, assigns NO_ALTITUDE so it can be patched with DEM elevation later.
 *
 * @param positions - Raw positions received for this tracker.
 * @param keepFromSec - Cutoff timestamp; older positions are discarded.
 * @param pilotTrack - Previous track in state for the pilot (if any).
 * @param messageAffinityMin - Maximum age in minutes of a prior fix to borrow altitude from.
 * @returns Array of resolved LivePoints.
 */
export function processOgnPositions(
  positions: AprsPosition[],
  keepFromSec: number,
  pilotTrack?: protos.LiveTrack,
  messageAffinityMin = OGN_ALTITUDE_AFFINITY_MIN,
): LivePoint[] {
  const recentPositions = positions.filter((p) => p.timeSec > keepFromSec);
  if (recentPositions.length === 0) {
    return [];
  }

  recentPositions.sort((a, b) => a.timeSec - b.timeSec);

  return recentPositions.map((p, i) => {
    let alt = p.alt;
    if (alt == null) {
      // 1. Look for closest point with altitude in the current cycle.
      let minDelta = Infinity;
      for (let j = 0; j < recentPositions.length; j++) {
        if (j !== i && recentPositions[j].alt != null) {
          const delta = Math.abs(recentPositions[j].timeSec - p.timeSec);
          if (delta < minDelta) {
            minDelta = delta;
            alt = recentPositions[j].alt;
          }
        }
      }

      // 2. If no altitude in current cycle, check previous fix in pilot's track within affinity.
      if (alt == null && pilotTrack && pilotTrack.timeSec.length > 0) {
        const lastFixTimeSec = pilotTrack.timeSec.at(-1)!;
        const lastFixAlt = pilotTrack.alt.at(-1)!;
        if (lastFixAlt !== NO_ALTITUDE && Math.abs(p.timeSec - lastFixTimeSec) <= messageAffinityMin * 60) {
          alt = lastFixAlt;
        }
      }

      // 3. Fallback to sentinel value if no recent altitude is known.
      if (alt == null) {
        alt = NO_ALTITUDE;
      }
    }

    const status = parseFntStatus(p.comment);
    return {
      lat: p.lat,
      lon: p.lon,
      alt,
      timeSec: p.timeSec,
      speed: p.speed,
      status,
    };
  });
}
