import { createClient, type RedisClientType } from 'redis';

export type RedisClient = RedisClientType<any, any, any, any>;
export type RedisClientMultiCmd = ReturnType<RedisClient['multi']>;

// lazily created client.
let redis: RedisClient | undefined;

export function getRedisClient(url: string): RedisClient {
  if (!redis) {
    redis = createClient({ url });
    redis.on('error', (err) => console.error('Redis Client Error', err));
    redis.connect().catch((err) => console.error('Redis connection failed', err));
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
  pipeline: RedisClientMultiCmd,
  key: string,
  list: Array<string | number>,
  capacity: number,
  maxLength = 400,
): RedisClientMultiCmd {
  const len = list.length;
  if (len == 0 || capacity <= 0) {
    return pipeline;
  }
  const elements = list.slice(-capacity);
  return pipeline
    .lPush(
      key,
      elements.map((v) => v.toString().substring(0, maxLength)),
    )
    .lTrim(key, 0, Math.max(0, capacity - 1));
}
