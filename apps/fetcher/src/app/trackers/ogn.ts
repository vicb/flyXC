// OGN API.
//
// See http://wiki.glidernet.org/.

import { protos, TrackerNames, validateOgnAccount } from '@flyxc/common';
import { ChainableCommander } from 'ioredis';
import { LivePoint, makeLiveTrack } from './live-track';
import { OgnClient } from './ogn-client';
import { OgnPusher } from './ogn-push';
import { TrackerFetcher, TrackerUpdates } from './tracker';

// Push positions to OGN.
let ognPusher: OgnPusher | undefined;

export class OgnFetcher extends TrackerFetcher {
  constructor(protected client: OgnClient, state: protos.FetcherState, pipeline: ChainableCommander) {
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
        .map((p) => ({
          lat: p.lat,
          lon: p.lon,
          alt: p.alt,
          timeMs: p.timeSec * 1000,
          name: 'ogn',
          speed: p.speed,
        }));

      if (points.length > 0) {
        const track = makeLiveTrack(points);
        updates.trackerDeltas.set(dsId, track);
      }
    }

    updates.errors.push(...this.client.getAndClearLogs());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }
}
