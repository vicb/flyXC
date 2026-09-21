// OGN API.
//
// See http://wiki.glidernet.org/.

import type { protos, TrackerNames } from '@flyxc/common';
import { parseFntStatus, validateOgnAccount } from '@flyxc/common';
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

      const points: LivePoint[] = positions
        .filter((p) => p.timeSec > keepFromSec)
        .map((p) => {
          const status = parseFntStatus(p.comment);
          return {
            lat: p.lat,
            lon: p.lon,
            alt: p.alt,
            timeSec: p.timeSec,
            speed: p.speed,
            status,
          };
        });

      if (points.length > 0 && dsId != null) {
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
