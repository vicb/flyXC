// https://bircom.in/
// https://github.com/vicb/flyXC/issues/301

import type { protos, TrackerNames } from '@flyxc/common';
import { findIndexes, Keys, removeBeforeFromLiveTrack, validateMeshBirAccount } from '@flyxc/common';
import type { MeshBirMessage } from '@flyxc/common-node';
import type { ChainableCommander, Redis } from 'ioredis';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

// Discard fixes older than
const KEEP_HISTORY_MIN = 20;
// Message affinity
const MESSAGE_AFFINITY_MIN = 10;

export class MeshBirFetcher extends TrackerFetcher {
  constructor(state: protos.FetcherState, pipeline: ChainableCommander, protected redis: Redis) {
    super(state, pipeline);
  }

  protected getTrackerName(): TrackerNames {
    return 'meshbir';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const messages = (await flushMessageQueue(this.redis)).filter((m) => m != null);

    if (messages.length == 0) {
      return;
    }

    // Maps meshbir ids to datastore ids.
    const meshIdToDsId = new Map<string, number>();
    for (const dsId of devices) {
      const tracker = this.getTracker(dsId);
      if (tracker == null) {
        updates.trackerErrors.set(dsId, `Not found`);
        continue;
      }
      if (validateMeshBirAccount(tracker.account) === false) {
        updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
        continue;
      }
      meshIdToDsId.set(tracker.account, dsId);
    }

    const pointsByMeshId = parse(messages, meshIdToDsId, this.state.pilots, MESSAGE_AFFINITY_MIN);

    for (const [meshId, points] of pointsByMeshId.entries()) {
      const dsId = meshIdToDsId.get(meshId);
      if (dsId != null) {
        const liveTrack = removeBeforeFromLiveTrack(
          makeLiveTrack(points),
          Math.round(Date.now() / 1000) - KEEP_HISTORY_MIN * 60,
        );
        if (liveTrack.timeSec.length > 0) {
          updates.trackerDeltas.set(dsId, liveTrack);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldFetch(tracker: protos.Tracker) {
    return true;
  }
}

export function parse(
  messages: MeshBirMessage[],
  meshIdToDsId: Map<string, number>,
  pilots: Record<string, protos.Pilot>,
  messageAffinityMin: number,
): Map<string, LivePoint[]> {
  const pointsByMeshId = new Map<string, LivePoint[]>();
  // Parse locations
  for (const msg of messages) {
    if (msg.type == 'position') {
      const point: LivePoint = {
        lat: msg.latitude,
        lon: msg.longitude,
        alt: msg.altitude,
        speed: msg.ground_speed,
        timeMs: msg.time,
        name: 'meshbir',
      };
      const meshId = validateMeshBirAccount(msg.user_id);
      if (meshId !== false) {
        const points = pointsByMeshId.get(meshId) ?? [];
        points.push(point);
        pointsByMeshId.set(meshId, points);
      }
    }
  }

  // Parse messages
  for (const msg of messages) {
    if (msg.type === 'message') {
      const text = msg.message.trim();
      if (text.length === 0) {
        return;
      }
      const meshId = validateMeshBirAccount(msg.user_id);
      if (meshId === false) {
        continue;
      }
      // Add the message on a position retrieved in the current cycle
      const points = pointsByMeshId.get(meshId) ?? [];
      if (points.length > 0) {
        const timesMs = points.map((p) => p.timeMs);
        const index = findIndexes(timesMs, msg.time).beforeIndex;
        points[index].message = text;
        continue;
      }
      // Get the position from the latest known location
      const dsId = meshIdToDsId.get(meshId);
      if (dsId === undefined) {
        continue;
      }
      const track = pilots[dsId]?.track;
      if (track === undefined || track.timeSec.length === 0) {
        continue;
      }
      const nowMs = Date.now();
      const lastFixAgeSec = Math.round(nowMs / 1000) - track.timeSec.at(-1);
      if (lastFixAgeSec > messageAffinityMin * 60) {
        continue;
      }
      points.push({
        lat: track.lat.at(-1),
        lon: track.lon.at(-1),
        alt: track.alt.at(-1),
        timeMs: nowMs,
        name: 'meshbir',
        message: text,
      });
      pointsByMeshId.set(meshId, points);
    }
  }

  return pointsByMeshId;
}

// Returns and empty the message queue.
async function flushMessageQueue(redis: Redis): Promise<MeshBirMessage[]> {
  try {
    const [[_, messages]] = await redis
      .multi()
      .lrange(Keys.meshBirMsgQueue, 0, -1)
      .ltrim(Keys.meshBirMsgQueue, 1, 0)
      .exec();

    // Return older messages first
    return (messages as string[])
      .map((json) => JSON.parse(json) as MeshBirMessage)
      .sort((a, b) => (a.time > b.time ? 1 : -1));
  } catch (e) {
    console.error('Error reading meshbir queue', e);
  }
}
