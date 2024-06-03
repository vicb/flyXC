import type { TrackerNames, protos} from '@flyxc/common';
import { Keys, validateZoleoAccount } from '@flyxc/common';
import type { ZoleoMessage } from '@flyxc/common-node';
import { LIVE_TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { ChainableCommander, Redis } from 'ioredis';
import type { LivePoint} from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

export class ZoleoFetcher extends TrackerFetcher {
  constructor(
    state: protos.FetcherState,
    pipeline: ChainableCommander,
    protected redis: Redis,
    protected datastore: Datastore,
  ) {
    super(state, pipeline);
  }

  protected getTrackerName(): TrackerNames {
    return 'zoleo';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const messages = (await flushMessageQueue(this.redis)).filter((m) => m != null);

    if (messages.length == 0) {
      return;
    }

    // Add new devices.
    const addedDevices = await addNewDevices(this.datastore, messages);
    if (addedDevices > 0) {
      // Sync added devices
      this.pipeline.incr(Keys.fetcherCmdSyncIncCount);
    }

    // Maps IMEI to datastore ids.
    const imeiToDsId = new Map<string, number>();
    for (const dsId of devices) {
      const tracker = this.getTracker(dsId);
      if (tracker == null) {
        updates.trackerErrors.set(dsId, `Not found ${tracker.account}`);
        continue;
      }
      if (validateZoleoAccount(tracker.account) === false) {
        updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
        continue;
      }
      imeiToDsId.set(tracker.account, dsId);
    }

    const pointsByImei = parse(messages);
    for (const [imei, points] of pointsByImei.entries()) {
      const dsId = imeiToDsId.get(imei);
      if (dsId != null) {
        updates.trackerDeltas.set(dsId, makeLiveTrack(points));
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }
}

export function parse(messages: ZoleoMessage[]): Map<string, LivePoint[]> {
  const pointsByImei = new Map<string, LivePoint[]>();
  for (const msg of messages) {
    if (msg.type != 'msg') {
      continue;
    }
    const point: LivePoint = {
      lat: msg.lat,
      lon: msg.lon,
      alt: msg.altitudeM,
      speed: msg.speedKph,
      timeMs: msg.timeMs,
      name: 'zoleo',
      emergency: msg.emergency,
      message: msg.message,
    };
    if (msg.batteryPercent < 20) {
      point.lowBattery = true;
    }
    const points = pointsByImei.get(msg.imei) ?? [];
    points.push(point);
    pointsByImei.set(msg.imei, points);
  }
  return pointsByImei;
}

async function addNewDevices(datastore: Datastore, messages: ZoleoMessage[]): Promise<number> {
  // add new devices.
  let addedDevices = 0;
  for (const msg of messages) {
    if (msg.type != 'imei') {
      continue;
    }
    try {
      const query = datastore.createQuery(LIVE_TRACK_TABLE).filter('zoleo.account', msg.id).limit(1);
      const [trackers] = await datastore.runQuery(query);
      if (trackers.length == 0) {
        console.error(`Can not find zoleo id = ${msg.id}`);
        continue;
      }
      const tracker = trackers[0];
      tracker.updated = new Date();
      tracker.zoleo.imei = msg.imei;

      await datastore.save({
        key: tracker[Datastore.KEY],
        data: tracker,
      });

      addedDevices++;
    } catch (e) {
      console.error(`Error adding a zoleo`, e);
    }
  }

  return addedDevices;
}

// Reand and empty the message queue.
async function flushMessageQueue(redis: Redis): Promise<(ZoleoMessage | null)[]> {
  try {
    const [[_, messages]] = await redis
      .multi()
      .lrange(Keys.zoleoMsgQueue, 0, -1)
      .ltrim(Keys.zoleoMsgQueue, 1, 0)
      .exec();

    // Return older messages first
    return (messages as string[]).map((json) => JSON.parse(json) as ZoleoMessage).reverse();
  } catch (e) {
    console.error('Error reading zoleo queue', e);
  }
}
