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
    const addedDevices = await confirmZoleoConsent(this.datastore, messages);
    if (addedDevices > 0) {
      // Sync added devices
      this.pipeline.incr(Keys.fetcherCmdSyncIncCount);
    }

    // Maps device ID to datastore ids.
    const idToDsId = new Map<string, number>();
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
      idToDsId.set(tracker.account, dsId);
    }

    const pointsById = parse(messages, idToDsId, this.state.pilots);
    for (const [id, points] of pointsById.entries()) {
      const dsId = idToDsId.get(id);
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
 * Converts queued Zoleo messages into live-track points grouped by device ID.
 *
 * Messages with coordinates become new points; location-less messages are
 * associated with a recent known position when possible.
 *
 * @param messages Queued Zoleo messages to convert.
 * @param idToDsId Mapping from Zoleo device IDs to datastore IDs.
 * @param pilots Current pilot tracks used to resolve location-less messages.
 * @param messageAffinityMin Maximum age, in minutes, of a fix used for a message.
 * @returns Live-track points grouped by Zoleo device ID.
 */
export function parse(
  messages: ZoleoMessage[],
  idToDsId = new Map<string, number>(),
  pilots: Record<string, protos.Pilot> = {},
  messageAffinityMin = MESSAGE_AFFINITY_MIN,
): Map<string, LivePoint[]> {
  const pointsById = new Map<string, LivePoint[]>();
  for (const msg of messages) {
    if (msg.type === 'message') {
      handleMessages(msg, pointsById, idToDsId, pilots, messageAffinityMin);
    } else if (msg.type === 'location') {
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
      const points = pointsById.get(msg.id) ?? [];
      pointsById.set(msg.id, points);
      points.push(point);
    }
  }
  return pointsById;
}

/**
 * Adds a Zoleo message as a point, or associates it with a recent known point
 * when the message does not include its own location.
 *
 * Messages without a location are discarded when no tracker is known or when
 * the tracker's latest fix is older than the affinity window.
 *
 * @param msg Zoleo message to handle.
 * @param pointsById Points collected for each Zoleo device in this cycle.
 * @param idToDsId Mapping from Zoleo device IDs to datastore IDs.
 * @param pilots Current pilot tracks used to resolve location-less messages.
 * @param messageAffinityMin Maximum age, in minutes, of a fix used for a message.
 */
function handleMessages(
  msg: Extract<ZoleoMessage, { type: 'message' }>,
  pointsById: Map<string, LivePoint[]>,
  idToDsId: Map<string, number>,
  pilots: Record<string, protos.Pilot>,
  messageAffinityMin: number,
): void {
  if (msg.message == null) {
    return;
  }

  // If the message contains a location, create a new point for it.
  if (msg.lat != null && msg.lon != null) {
    const points = pointsById.get(msg.id) ?? [];
    pointsById.set(msg.id, points);
    points.push({
      lat: msg.lat,
      lon: msg.lon,
      alt: msg.altitudeM,
      speed: msg.speedKph,
      timeMs: msg.timeMs,
      name: 'zoleo',
      message: msg.message,
    });
    return;
  }

  const dsId = idToDsId.get(msg.id);
  if (dsId == null) {
    return;
  }
  const track = pilots[dsId]?.track;
  if (track == null || track.timeSec.length === 0) {
    return;
  }

  const lastFixAgeSec = Math.round(Date.now() / 1000) - track.timeSec.at(-1);
  if (lastFixAgeSec > messageAffinityMin * 60) {
    return;
  }

  const lastIndex = track.timeSec.length - 1;
  pointsById.set(msg.id, [
    {
      lat: track.lat[lastIndex],
      lon: track.lon[lastIndex],
      alt: track.alt[lastIndex],
      timeMs: msg.timeMs,
      name: 'zoleo',
      message: msg.message,
    },
  ]);
}

/**
 * Populates the IMEI when a consent confirmation message is received.
 */
async function confirmZoleoConsent(datastore: Datastore, messages: ZoleoMessage[]): Promise<number> {
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
