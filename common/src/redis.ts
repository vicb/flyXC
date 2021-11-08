import IORedis from 'ioredis';

import { SecretKeys } from './keys';

// Keys for redis.
//
// `[List]` prefix denotes REDIS lists.
export const enum Keys {
  // # Commands

  // Export the periodic file.
  fetcherCmdExportFile = 'f:cmd:export:file',
  // Capture the current state to `fetcherStateBrotli`.
  fetcherCmdCaptureState = 'f:cmd:capture:state',
  // [List] Incremental sync from the DB. Triggered on account updates.
  // This key is a counter so that we do not miss sequential updates.
  // It should be access via INCR/DECR.
  fetcherCmdSyncIncCount = 'f:cmd:sync:count',
  // Full sync.
  fetcherCmdSyncFull = 'f:cmd:sync:full',

  // Using brotli divide the Buffer size by ~4.
  fetcherStateBrotli = 'f:state',

  // # State

  fetcherMemoryRssMb = 'f:state:memRss',
  fetcherMemoryHeapMb = 'f:state:memHeap',

  fetcherStartedSec = 'f:state:started',
  fetcherReStartedSec = 'f:state:restarted',
  fetcherStoppedSec = 'f:state:stopped',
  fetcherNumTicks = 'f:state:ticks',
  // [List]
  fetcherLastTicksSec = 'f:state:lastTick',
  fetcherNumStarts = 'f:state:starts',
  // Max of device updated time.
  fetcherLastDeviceUpdatedMs = 'f:state:lastUpdated',

  fetcherNextPartialSyncSec = 'f:state:nextPartialSync',
  fetcherNextFullSyncSec = 'f:state:nextFullSync',
  fetcherNextExportSec = 'f:state:nextExport',

  // # Live Tracks

  // Full tracks.
  fetcherFullProto = 'f:live:full:proto',
  // Number of full tracks.
  fetcherFullNumTracks = 'f:live:full:size',
  // Incremental tracks.
  fetcherIncrementalProto = 'f:live:inc:proto',
  // Number of incremental tracks.
  fetcherIncrementalNumTracks = 'f:live:inc:size',
  // Tracks exported to FlyMe.
  fetcherExportFlymeProto = 'f:live:export:flyme',

  // # Devices

  // Total number of enabled trackers.
  trackerNum = 'f:tracker:num',
  // Number of enabled trackers per type.
  trackerNumByType = 'f:tracker:{name}:num',
  // [List] Global errors.
  trackerErrorsByType = 'f:tracker:{name}:errors',
  // [List] Errors per account.
  trackerErrorsById = 'f:tracker:{name}:errors:id',
  // [List] Devices with high consecutive errors.
  trackerConsecutiveErrorsById = 'f:tracker:{name}:consErrors:id',
  // [List] Devices with high consecutive errors.
  trackerManyErrorsById = 'f:tracker:{name}:manyErrors:id',
  // [List] Number of fetch devices.
  trackerNumFetches = 'f:tracker:{name}:fetches',
  // [List] Number of fetch devices.
  trackerNumUpdates = 'f:tracker:{name}:updates',
  // [List] Fetch duration in seconds.
  trackerFetchDuration = 'f:tracker:{name}:duration',

  // # Sync from datastore (type is "full" or "inc") and export to storage.

  // [List] Errors.
  stateSyncErrors = 'f:sync:{type}:errors',
  // [List] Number of devices synced.
  stateSyncNum = 'f:sync:{type}:synced',
  // [List] Status of the export.
  stateExportStatus = `f:export:status`,

  // # Misc

  // [List]
  elevationErrors = 'f:elev:errors',
  // [List]
  elevationNumFetched = 'f:elev:fetched',
  // [List]
  elevationNumRetrieved = 'f:elev:retrieved',

  // Last datastore request for dashboard.
  dsLastRequestSec = 'f:ds:time',

  // Number of tracks.
  trackNum = 'f:tracks',
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
// Notes:
// - At most `capacity` elements are pushed,
// - the list is trimmed to the capacity,
// - each value is limited to maxLength chars,
// - most recent list elements should be last (tail is dropped first).
export function pushListCap(
  pipeline: IORedis.Pipeline,
  key: string,
  list: Array<string | number>,
  capacity: number,
  maxLength = 400,
): void {
  const len = list.length;
  if (len == 0 || capacity == 0) {
    return;
  }
  const elements = list.slice(len - capacity, len);
  pipeline
    .lpush(key, ...elements.map((v) => v.toString().substring(0, maxLength)))
    .ltrim(key, 0, Math.max(0, capacity - 1));
}
