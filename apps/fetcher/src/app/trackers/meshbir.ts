// https://bircom.in/
// https://github.com/vicb/flyXC/issues/301

import type { protos, TrackerNames } from '@flyxc/common';
import { Keys, removeBeforeFromLiveTrack, validateMeshBirAccount } from '@flyxc/common';
import type { MeshBirMessage } from '@flyxc/common-node';
import type { ChainableCommander, Redis } from 'ioredis';

import type { LivePoint } from './live-track';
import { makeLiveTrack } from './live-track';
import type { TrackerUpdates } from './tracker';
import { TrackerFetcher } from './tracker';

const KEEP_HISTORY_MIN = 20;

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
        updates.trackerErrors.set(dsId, `Not found ${tracker.account}`);
        continue;
      }
      if (validateMeshBirAccount(tracker.account) === false) {
        updates.trackerErrors.set(dsId, `Invalid account ${tracker.account}`);
        continue;
      }
      meshIdToDsId.set(tracker.account, dsId);
    }

    const pointsByMeshId = parse(messages);

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

export function parse(messages: MeshBirMessage[]): Map<string, LivePoint[]> {
  const pointsByMeshId = new Map<string, LivePoint[]>();
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
    return (messages as string[]).map((json) => JSON.parse(json)).reverse();
  } catch (e) {
    console.error('Error reading meshbir queue', e);
  }
}
