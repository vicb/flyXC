import IORedis from 'ioredis';

import { SecretKeys } from './keys';

export const enum Keys {
  // Timestamp of the last request from the frontend.
  trackerRequestTimestamp = 'tracker:request:time',
  // Full tracks.
  trackerFullProto = 'tracker:proto:full',
  // Number of full tracks.
  trackerFullSize = 'tracker:proto:full:size',
  // Incremental tracks.
  trackerIncrementalProto = 'tracker:proto:inc',
  // Number of incremental tracks.
  trackerIncrementalSize = 'tracker:proto:inc:size',
  // Tracks exported to FlyMe.
  trackerFlymeProto = 'tracker:proto:flyme',
  // Last tracker update (start time).
  trackerUpdateSec = 'tracker:update:time',
  // trackers errors.
  trackerLogsPrefix = 'tracker:log',
}

// lazily created client.
let redis: IORedis.Redis | undefined;

export function getRedisClient(): IORedis.Redis {
  if (!redis) {
    redis = new IORedis(SecretKeys.REDIS_URL);
  }
  return redis;
}

// Pushes the elements to a capped list.
//
// At most `capacity` elements are pushed and the list is trimmed to the capacity.
// Each value is limited to maxLength chars.
export function pushListCap(
  pipeline: IORedis.Pipeline,
  key: string,
  list: Array<string | number>,
  capacity: number,
  maxLength = 1000,
): void {
  const len = Math.min(capacity, list.length);
  for (let i = 0; i < len; i++) {
    pipeline.lpush(key, list[i].toString().substr(0, maxLength));
  }
  pipeline.ltrim(key, 0, Math.max(0, capacity - 1));
}
