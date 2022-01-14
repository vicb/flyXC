import { FetcherState, Tracker } from 'flyxc/common/protos/fetcher-state';
import { trackerPropNames } from 'flyxc/common/src/live-track';
import { Keys, pushListCap } from 'flyxc/common/src/redis';
import { Pipeline, Redis } from 'ioredis';
import zlib from 'zlib';

import { ElevationUpdates } from './elevation/elevation';
import { exportToStorage } from './state/serialize';
import { BUCKET_NAME, EXPORT_FILE_SEC, PERIODIC_STATE_PATH } from './state/state';
import { syncFromDatastore, SyncStatus } from './state/sync';
import { TrackerUpdates } from './trackers/tracker';

// Logs for syncs.
export function addSyncLogs(pipeline: Pipeline, status: SyncStatus, timeSec: number) {
  const type = status.full ? 'full' : 'inc';

  if (status.errors.length) {
    pushListCap(pipeline, Keys.stateSyncErrors.replace('{type}', type), [`[${timeSec}] status.errors.join(', ')`], 5);
  } else {
    pushListCap(pipeline, Keys.stateSyncNum.replace('{type}', type), [`[${timeSec}] ${status.numSync}`], 20);
  }
}

// Logs for export to datastore.
export function addExportLogs(pipeline: Pipeline, success: boolean, timeSec: number) {
  pushListCap(pipeline, Keys.stateExportStatus, [`[${timeSec}] ${success ? 'ok' : 'ko'}`], 5);
}

// Logs the elevation updates.
export function addElevationLogs(pipeline: Pipeline, updates: ElevationUpdates, timeSec: number): void {
  pushListCap(
    pipeline,
    Keys.elevationErrors,
    updates.errors.map((e) => `[${timeSec}] ${e}`),
    5,
  );
  pushListCap(pipeline, Keys.elevationNumFetched, [updates.numFetched], 5);
  pushListCap(pipeline, Keys.elevationNumRetrieved, [updates.numRetrieved], 5);
}

// Logs updates for a tracker type.
export function addTrackerLogs(pipeline: Pipeline, updates: TrackerUpdates, state: FetcherState): void {
  const name = trackerPropNames[updates.trackerId];
  const time = updates.startFetchSec;

  pushListCap(
    pipeline,
    Keys.trackerErrorsByType.replace('{name}', name),
    updates.errors.map((e) => `[${time}] ${e}`),
    20,
  );
  pushListCap(
    pipeline,
    Keys.trackerErrorsById.replace('{name}', name),
    [...updates.trackerErrors.entries()].map(([id, e]) => `[${time}] id=${id} ${e}`),
    20,
  );
  pushListCap(pipeline, Keys.trackerNumFetches.replace('{name}', name), [updates.fetchedTracker.size], 20);
  pushListCap(pipeline, Keys.trackerNumUpdates.replace('{name}', name), [updates.trackerDeltas.size], 20);
  pushListCap(
    pipeline,
    Keys.trackerFetchDuration.replace('{name}', name),
    [updates.endFetchSec - updates.startFetchSec],
    20,
  );

  // Consecutive errors.
  for (const [id, error] of updates.trackerErrors.entries()) {
    const numConsErrors = ((state.pilots[id] as any)[name] as Tracker).numConsecutiveErrors;
    if (numConsErrors > 10) {
      pushListCap(
        pipeline,
        Keys.trackerConsecutiveErrorsById.replace('{name}', name),
        [`[${time}] id=${id} ${error}`],
        20,
      );
    }
    const numErrors = ((state.pilots[id] as any)[name] as Tracker).numErrors;
    if (numErrors > 300) {
      pushListCap(
        pipeline,
        Keys.trackerManyErrorsById.replace('{name}', name),
        [`[${time}] id=${id} ${numErrors} errors`],
        20,
      );
    }
  }
}

// Logs state variables.
export function addStateLogs(pipeline: Pipeline, state: FetcherState): void {
  pipeline
    .set(Keys.fetcherMemoryHeapMb, state.memHeapMb)
    .set(Keys.fetcherMemoryRssMb, state.memRssMb)
    .set(Keys.fetcherStartedSec, state.startedSec)
    .set(Keys.fetcherReStartedSec, state.reStartedSec)
    .set(Keys.fetcherStoppedSec, state.stoppedSec)
    .set(Keys.fetcherNumTicks, state.numTicks)
    .set(Keys.fetcherNumStarts, state.numStarts)
    .set(Keys.fetcherLastDeviceUpdatedMs, state.lastUpdatedMs)
    .set(Keys.fetcherNextPartialSyncSec, state.nextPartialSyncSec)
    .set(Keys.fetcherNextFullSyncSec, state.nextFullSyncSec)
    .set(Keys.fetcherNextExportSec, state.nextExportSec);

  pushListCap(pipeline, Keys.fetcherLastTicksSec, [state.lastTickSec], 10);

  // Number of enabled trackers.
  let total = 0;
  const byName: { [name: string]: number } = {};

  for (const pilot of Object.values(state.pilots)) {
    if (pilot.enabled) {
      total++;
      for (const name of Object.values(trackerPropNames)) {
        if ((pilot as any)[name].enabled) {
          byName[name] = (byName[name] ?? 0) + 1;
        }
      }
    }
  }

  pipeline.set(Keys.trackerNum, total);
  for (const name of Object.values(trackerPropNames)) {
    pipeline.set(Keys.trackerNumByType.replace('{name}', name), byName[name] ?? 0);
  }
}

// Handle the commands received via REDIS.
export async function HandleCommand(redis: Redis, state: FetcherState): Promise<void> {
  try {
    const [[, cmdCapture], [, cmdExport], [, cmdSyncCount], [, cmdSyncFull]] = await redis
      .pipeline()
      .get(Keys.fetcherCmdCaptureState)
      .get(Keys.fetcherCmdExportFile)
      .get(Keys.fetcherCmdSyncIncCount)
      .get(Keys.fetcherCmdSyncFull)
      .exec();

    if (cmdCapture != null) {
      const snapshot = Buffer.from(FetcherState.toBinary(state));
      await redis
        .pipeline()
        .del(Keys.fetcherCmdCaptureState)
        .set(Keys.fetcherStateBrotli, zlib.brotliCompressSync(snapshot), 'EX', 10 * 60)
        .exec();
      console.log(`[cmd] state captured`);
    }

    if (cmdExport != null) {
      const success = await exportToStorage(state, BUCKET_NAME, PERIODIC_STATE_PATH);
      state.nextExportSec = state.lastTickSec + EXPORT_FILE_SEC;
      const pipeline = redis.pipeline();
      pipeline.del(Keys.fetcherCmdExportFile);
      addExportLogs(pipeline, success, state.lastTickSec);
      await pipeline.exec();
    }

    if (cmdSyncCount != null) {
      const pipeline = redis.pipeline();
      const count = Number(cmdSyncCount);
      if (isNaN(count) || count < 0) {
        pipeline.del(Keys.fetcherCmdSyncIncCount);
      } else if (count > 0) {
        const status = await syncFromDatastore(state, { full: false });
        pipeline.decrby(Keys.fetcherCmdSyncIncCount, count);
        addSyncLogs(pipeline, status, state.lastTickSec);
      }
      await pipeline.exec();
    }

    if (cmdSyncFull != null) {
      const status = await syncFromDatastore(state, { full: true });
      const pipeline = redis.pipeline();
      pipeline.del(Keys.fetcherCmdSyncFull);
      addSyncLogs(pipeline, status, state.lastTickSec);
      await pipeline.exec();
    }
  } catch (e) {
    console.error(`[cmd] error:\n${e}`);
  }
}
