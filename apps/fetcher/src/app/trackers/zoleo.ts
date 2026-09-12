// Zoleo tracker fetcher implementation.
//
// - Dashboard: https://www.myzoleo.com/dashboard
// - Data Feed docs: https://developers.zoleo.com/docs/guides/integration-guides-data-feed
// - Cloud Connect: https://cloudconnect.zoleo.com/

import type { protos, TrackerNames } from '@flyxc/common';
import { Keys, validateZoleoAccount } from '@flyxc/common';
import type { RedisClient, RedisClientMultiCmd, ZoleoMessage } from '@flyxc/common-node';
import { LIVE_TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

const MESSAGE_AFFINITY_MIN = 15;

export class ZoleoFetcher extends TrackerFetcher {
  constructor(
    state: protos.FetcherState,
    pipeline: RedisClientMultiCmd,
    protected redis: RedisClient,
    protected datastore: Datastore,
  ) {
    super(state, pipeline);
  }

  protected getTrackerName(): TrackerNames {
    return 'zoleo';
  }

  protected async fetch(devices: number[], updates: TrackerUpdates, _timeoutSec: number): Promise<void> {
    const messages = (await flushMessageQueue(this.redis)).filter((m) => m != null);

    if (messages.length == 0) {
      return;
    }

    // Add new devices.
    const addedDevices = await handleZoleoConsent(this.datastore, messages);
    if (addedDevices > 0) {
      // Sync added devices
      this.pipeline.incr(Keys.fetcherCmdSyncIncCount);
    }

    // Maps IMEI to datastore ids.
    const imeiToDsId = new Map<string, number>();
    for (const dsId of devices) {
      const tracker = this.getTracker(dsId);
      if (tracker == null) {
        updates.trackerErrors.set(dsId, `Not found`);
        continue;
      }
      if (validateZoleoAccount(tracker.account) === false) {
        updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
        continue;
      }
      imeiToDsId.set(tracker.account, dsId);
    }

    const pointsByImei = parse(messages);
    handleLocationlessMessage(messages, pointsByImei, imeiToDsId, this.state.pilots, MESSAGE_AFFINITY_MIN);
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

/**
 * Converts queued Zoleo messages into live-track points grouped by IMEI.
 *
 * Only location updates and messages that include coordinates become points.
 * Location-less messages are handled separately after all locations are parsed.
 *
 * @param messages Queued Zoleo messages to convert.
 * @returns Live-track points grouped by Zoleo IMEI.
 */
export function parse(messages: ZoleoMessage[]): Map<string, LivePoint[]> {
  const pointsByImei = new Map<string, LivePoint[]>();

  for (const msg of messages) {
    if (msg.type === 'location') {
      const points = pointsByImei.get(msg.imei) ?? [];
      pointsByImei.set(msg.imei, points);
      const point: LivePoint = {
        lat: msg.lat,
        lon: msg.lon,
        alt: msg.altitudeM,
        timeMs: msg.timeMs,
        name: 'zoleo',
      };
      if (msg.emergency) {
        point.emergency = msg.emergency;
      }
      if (msg.message != null) {
        point.message = msg.message;
      }
      if (msg.batteryPercent < 20) {
        point.lowBattery = true;
      }
      points.push(point);
    } else if (msg.type === 'message' && msg.lat != null && msg.lon != null) {
      const points = pointsByImei.get(msg.imei) ?? [];
      pointsByImei.set(msg.imei, points);
      const point: LivePoint = {
        lat: msg.lat,
        lon: msg.lon,
        alt: msg.altitudeM ?? 0,
        timeMs: msg.timeMs,
        name: 'zoleo',
        message: msg.message,
      };
      if (msg.batteryPercent < 20) {
        point.lowBattery = true;
      }
      points.push(point);
    }
  }

  return pointsByImei;
}

/**
 * Associates a location-less Zoleo message with the device's recent known point.
 *
 * Messages without a location are discarded when no tracker is known or when
 * the tracker's latest fix is older than the affinity window.
 *
 * @param messages Queued Zoleo messages to reconcile.
 * @param pointsByImei Points collected for each Zoleo device in this cycle.
 * @param imeiToDsId Mapping from Zoleo IMEIs to datastore IDs.
 * @param pilots Current pilot tracks used to resolve location-less messages.
 * @param messageAffinityMin Maximum age, in minutes, of a fix used for a message.
 */
export function handleLocationlessMessage(
  messages: ZoleoMessage[],
  pointsByImei: Map<string, LivePoint[]>,
  imeiToDsId: Map<string, number>,
  pilots: Record<string, protos.Pilot>,
  messageAffinityMin: number,
): void {
  for (const msg of messages) {
    if (msg.type !== 'message' || (msg.lat != null && msg.lon != null)) {
      continue;
    }

    const dsId = imeiToDsId.get(msg.imei);
    if (dsId == null) {
      continue;
    }
    const track = pilots[dsId]?.track;
    if (track == null || track.timeSec.length === 0) {
      continue;
    }

    const lastFixAgeSec = msg.timeMs / 1000 - track.timeSec.at(-1);
    if (lastFixAgeSec > messageAffinityMin * 60) {
      continue;
    }

    const points = pointsByImei.get(msg.imei) ?? [];
    pointsByImei.set(msg.imei, points);
    points.push({
      lat: track.lat.at(-1),
      lon: track.lon.at(-1),
      alt: track.alt.at(-1),
      timeMs: msg.timeMs,
      name: 'zoleo',
      message: msg.message,
    });
  }
}

/**
 * Populates the account with the IMEI when a consent confirmation message is received.
 */
async function handleZoleoConsent(datastore: Datastore, messages: ZoleoMessage[]): Promise<number> {
  // add new devices.
  let addedDevices = 0;
  for (const msg of messages) {
    if (msg.type != 'imei') {
      continue;
    }
    try {
      const query = datastore.createQuery(LIVE_TRACK_TABLE).filter('zoleo.device_id', msg.device_id).limit(1);
      const [trackers] = await datastore.runQuery(query);
      if (trackers.length == 0) {
        console.error(`Can not find zoleo device_id = ${msg.device_id}`);
        continue;
      }
      const tracker = trackers[0];
      tracker.updated = new Date();
      tracker.zoleo.account = msg.imei;

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

// Returns and empty the message queue.
async function flushMessageQueue(redis: RedisClient): Promise<(ZoleoMessage | null)[]> {
  try {
    const [messages] = await redis
      .multi()
      .lRange(Keys.zoleoMsgQueue, 0, -1)
      .lTrim(Keys.zoleoMsgQueue, 1, 0)
      .execTyped(true);

    // Return older messages first
    return (messages as string[]).map((json) => JSON.parse(json) as ZoleoMessage).reverse();
  } catch (e) {
    console.error('Error reading zoleo queue', e);
  }
}
