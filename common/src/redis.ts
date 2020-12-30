import IORedis from 'ioredis';

import { SecretKeys } from './keys';

export const enum Keys {
  // Timestamp of the last request from the frontend.
  trackerRequestTime = 'trk.request.time',
  // Full tracks.
  trackerFullProto = 'trk.full.proto',
  // Number of full tracks.
  trackerFullSize = 'trk.full.size',
  // Incremental tracks.
  trackerIncrementalProto = 'trk.inc.proto',
  // Number of incremental tracks.
  trackerIncrementalSize = 'trk.inc.size',
  // Tracks exported to FlyMe.
  trackerFlymeProto = 'trk.flyme.proto',
  // Last tracker update (start time).
  trackerUpdateSec = 'trk.update.time',
}

// lazily created client.
let redis: IORedis.Redis | undefined;

export function getRedisClient(): IORedis.Redis {
  if (!redis) {
    redis = new IORedis(SecretKeys.REDIS_URL);
  }
  return redis;
}
