import * as os from 'node:os';
import * as zlib from 'node:zlib';

import { Keys, protos, trackerNames } from '@flyxc/common';
import type { RedisClient, RedisClientMultiCmd } from '@flyxc/common-node';
import { pushListCap } from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import { OSUtils } from 'node-os-utils';

import type { ElevationUpdates } from './elevation/elevation';
import { exportToStorage } from './state/serialize';
import { BUCKET_NAME, EXPORT_FILE_SEC, PERIODIC_STATE_PATH } from './state/state';
import type { SyncStatus } from './state/sync';
import { syncFromDatastore } from './state/sync';

// Logs for syncs.
export function addSyncLogs(pipeline: RedisClientMultiCmd, status: SyncStatus, timeSec: number) {
  const type = status.full ? 'full' : 'inc';

  if (status.errors.length) {
    pushListCap(
      pipeline,
      Keys.stateSyncErrors.replace('{type}', type),
      [`[${timeSec}] ${status.errors.join(', ')}`],
      5,
    );
  } else {
    pushListCap(pipeline, Keys.stateSyncNum.replace('{type}', type), [`[${timeSec}] ${status.numSync}`], 20);
  }
}

// Logs for export to datastore.
export function addExportLogs(pipeline: RedisClientMultiCmd, success: boolean, timeSec: number) {
  pushListCap(pipeline, Keys.stateExportStatus, [`[${timeSec}] ${success ? 'ok' : 'ko'}`], 5);
}

// Logs the elevation updates.
export function addElevationLogs(pipeline: RedisClientMultiCmd, updates: ElevationUpdates, timeSec: number): void {
  pushListCap(
    pipeline,
    Keys.elevationErrors,
    updates.errors.map((e) => `[${timeSec}] ${e}`),
    5,
  );
  pushListCap(pipeline, Keys.elevationNumFetched, [updates.numFetched], 5);
  pushListCap(pipeline, Keys.elevationNumRetrieved, [updates.numRetrieved], 5);
}

const osUtils = new OSUtils({ cpu: { cacheTTL: 5 * 60 * 1000 } });

let cpuUsage = 0;
let cpuUsagePromise: Promise<number> | null = null;

// Logs host info.
export async function addHostInfo(pipeline: RedisClientMultiCmd): Promise<void> {
  // CPU usage over 5min.
  if (cpuUsagePromise == null) {
    cpuUsagePromise = osUtils.cpu
      .usage()
      .then((res) => (cpuUsage = res.success ? res.data : 0))
      .finally(() => (cpuUsagePromise = null));
  }

  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const usedMemMb = Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));

  pipeline
    .set(Keys.hostCpuUsage, cpuUsage)
    .set(Keys.hostMemoryUsedMb, usedMemMb)
    .set(Keys.hostMemoryTotalMb, totalMemMb)
    .set(Keys.hostUptimeSec, Math.round(os.uptime()));
}

// Logs state variables.
export function addStateLogs(pipeline: RedisClientMultiCmd, state: protos.FetcherState): void {
  pipeline
    .set(Keys.fetcherMemoryHeapMb, state.memHeapMb)
    .set(Keys.fetcherMemoryRssMb, state.memRssMb)
    .set(Keys.fetcherStartedSec, state.startedSec)
    .set(Keys.fetcherReStartedSec, state.reStartedSec)
    .set(Keys.fetcherStoppedSec, state.stoppedSec)
    .set(Keys.fetcherNextStopSec, state.nextStopSec)
    .set(Keys.fetcherNumTicks, state.numTicks)
    .set(Keys.fetcherNumStarts, state.numStarts)
    .set(Keys.fetcherLastDeviceUpdatedMs, state.lastUpdatedMs)
    .set(Keys.fetcherNextPartialSyncSec, state.nextPartialSyncSec)
    .set(Keys.fetcherNextFullSyncSec, state.nextFullSyncSec)
    .set(Keys.fetcherNextExportSec, state.nextExportSec)
    .set(Keys.hostNode, state.nodeVersion);

  pushListCap(pipeline, Keys.fetcherLastTicksSec, [state.lastTickSec], 10);

  // Number of enabled trackers.
  let total = 0;
  const byName: { [name: string]: number } = {};

  for (const pilot of Object.values(state.pilots)) {
    if (pilot.enabled) {
      total++;
      for (const name of trackerNames) {
        if (pilot[name]?.enabled) {
          byName[name] = (byName[name] ?? 0) + 1;
        }
      }
    }
  }

  pipeline.set(Keys.trackerNum, total);
  for (const name of trackerNames) {
    pipeline.set(Keys.trackerNumByType.replace('{name}', name), byName[name] ?? 0);
  }
}

// Handle the commands received via REDIS.
export async function HandleCommand(
  redis: RedisClient,
  state: protos.FetcherState,
  datastore: Datastore,
): Promise<void> {
  try {
    const [cmdCapture, cmdExport, cmdSyncCount, cmdSyncFull] = await redis
      .multi()
      .get(Keys.fetcherCmdCaptureState)
      .get(Keys.fetcherCmdExportFile)
      .get(Keys.fetcherCmdSyncIncCount)
      .get(Keys.fetcherCmdSyncFull)
      .execTyped(true);

    if (cmdCapture != null) {
      const snapshot = Buffer.from(protos.FetcherState.toBinary(state));
      await redis
        .multi()
        .del(Keys.fetcherCmdCaptureState)
        .set(Keys.fetcherStateBrotli, zlib.brotliCompressSync(snapshot), { EX: 10 * 60 })
        .execTyped(true);
      console.log(`[cmd] state captured`);
    }

    if (cmdExport != null) {
      const success = await exportToStorage(state, BUCKET_NAME, PERIODIC_STATE_PATH);
      state.nextExportSec = state.lastTickSec + EXPORT_FILE_SEC;
      const pipeline = redis.multi();
      pipeline.del(Keys.fetcherCmdExportFile);
      addExportLogs(pipeline, success, state.lastTickSec);
      await pipeline.execTyped(true);
    }

    if (cmdSyncCount != null) {
      const pipeline = redis.multi();
      const count = Number(cmdSyncCount);
      if (isNaN(count) || count < 0) {
        pipeline.del(Keys.fetcherCmdSyncIncCount);
      } else if (count > 0) {
        const status = await syncFromDatastore(datastore, state, { full: false });
        pipeline.decrBy(Keys.fetcherCmdSyncIncCount, count);
        addSyncLogs(pipeline, status, state.lastTickSec);
      }
      await pipeline.execTyped(true);
    }

    if (cmdSyncFull != null) {
      const status = await syncFromDatastore(datastore, state, { full: true });
      const pipeline = redis.multi();
      pipeline.del(Keys.fetcherCmdSyncFull);
      addSyncLogs(pipeline, status, state.lastTickSec);
      await pipeline.execTyped(true);
    }
  } catch (e) {
    console.error(`[cmd] error:\n${e}`);
  }
}
