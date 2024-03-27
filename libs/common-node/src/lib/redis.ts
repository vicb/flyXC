import Redis, { ChainableCommander } from 'ioredis';

import { SecretKeys } from '@flyxc/common';

// lazily created client.
let redis: Redis | undefined;

export function getRedisClient(): Redis {
  if (!redis) {
    const keyPrefix = process.env.NODE_ENV == 'development' ? 'dev:' : undefined;
    redis = new Redis(SecretKeys.REDIS_URL, { keyPrefix });
  }
  return redis;
}

// Pushes the elements to a capped list.
//
// Notes:
// - At most `capacity` elements are pushed,
// - the list is trimmed to the capacity,
// - each value is limited to maxLength chars,
// - most recent list elements should be last (head is dropped first).
export function pushListCap(
  pipeline: ChainableCommander,
  key: string,
  list: Array<string | number>,
  capacity: number,
  maxLength = 400,
): ChainableCommander {
  const len = list.length;
  if (len == 0 || capacity == 0) {
    return;
  }
  const elements = list.slice(len - capacity, len);
  return pipeline
    .lpush(key, ...elements.map((v) => v.toString().substring(0, maxLength)))
    .ltrim(key, 0, Math.max(0, capacity - 1));
}
