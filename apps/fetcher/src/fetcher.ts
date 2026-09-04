import { EventEmitter } from 'node:events';
// Do not use "process" because the global "process.env" is
// replaced at build time by Vite.
import nodeProcess from 'node:process';

import { Keys, LIVE_REFRESH_SEC, protos } from '@flyxc/common';
import type { RedisClientMultiCmd } from '@flyxc/common-node';
import { getDatastore, getRedisClient } from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import { program } from 'commander';

import { addExportLogs, addHostInfo, addStateLogs, addSyncLogs, HandleCommand } from './app/redis';
import { createStateArchive, exportToStorage } from './app/state/serialize';
import {
  ARCHIVE_STATE_FILE,
  ARCHIVE_STATE_FOLDER,
  BUCKET_NAME,
  createInitState,
  EXPORT_ARCHIVE_SEC,
  EXPORT_FILE_SEC,
  PERIODIC_STATE_PATH,
  restoreState,
  SHUTDOWN_STATE_PATH,
} from './app/state/state';
import { syncFromDatastore } from './app/state/sync';
import { createLiveTrackGroups, protoToBuffer } from './app/track-groups';
import { disconnectOgnClient, resfreshTrackers } from './app/trackers/refresh';
import { resfreshUfoFleets } from './app/ufos/refresh';

// @google-cloud/storage v8 internal streams (PassThroughShim in file.js) attach 11 close/error
// listeners during pipeline uploads/downloads (e.g. for CRC32C, retry handling, and duplexify).
// This exceeds Node's default limit of 10 and emits MaxListenersExceededWarning.
// Increasing the default limit silences this benign upstream advisory warning.
EventEmitter.defaultMaxListeners = 25;

const redis = getRedisClient(process.env.NODE_ENV === 'development' ? SECRETS.REDIS_URL_DEV : SECRETS.REDIS_URL);

program.option('-e, --exit_hours <hours>', 'restart after', '0').parse();

const exitAfterHour = parseFloat(program.opts().exit_hours);
const exitAfterSec = isNaN(exitAfterHour) ? 0 : Math.round(exitAfterHour * 3600);

let state = createInitState();

(async () => {
  const datastore = getDatastore();
  await start(datastore);
})();

// Loads the state from storage and start ticking.
async function start(datastore: Datastore): Promise<void> {
  state = await restoreState(state);

  if (state.numStarts == 0) {
    const status = await syncFromDatastore(datastore, state, { full: true });
    console.log(`Initial sync from the datastore`, status);
  }

  state.nodeVersion = nodeProcess.version;
  state.numStarts++;
  state.inTick = false;
  state.numTicks = 0;
  state.reStartedSec = Math.round(Date.now() / 1000);
  state.nextStopSec = exitAfterSec == 0 ? 0 : exitAfterSec + Math.round(Date.now() / 1000);

  console.log(`State last tick ${new Date(state.lastTickSec * 1000)}`);

  tick(state, datastore);
  const ticker = setInterval(() => tick(state, datastore), LIVE_REFRESH_SEC * 1000);

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    nodeProcess.on(signal, async () => {
      clearInterval(ticker);
      await shutdown(state);
    });
  }
}

// Main loop.
async function tick(state: protos.FetcherState, datastore: Datastore) {
  if (state.inTick) {
    return;
  }

  if (state.numTicks % 100 == 0) {
    console.log(`tick #${state.numTicks}`);
  }

  state.inTick = true;
  state.numTicks++;
  state.lastTickSec = Math.round(Date.now() / 1000);

  try {
    const memory = nodeProcess.memoryUsage();
    state.memHeapMb = Math.round(memory.heapTotal / 1e6);
    state.memRssMb = Math.round(memory.rss / 1e6);

    const pipeline = redis.multi();

    await updateAll(pipeline, state, datastore);

    addStateLogs(pipeline, state);
    await addHostInfo(pipeline);

    if (state.nextStopSec > 0 && state.lastTickSec > state.nextStopSec) {
      // We do not need to sync on shutdown as there will be a sync on startup.
      await pipeline.execTyped(true);
      state.nextStopSec = state.lastTickSec + exitAfterSec;
      await shutdown(state);
    } else {
      // Sync from Datastore.
      if (state.lastTickSec > state.nextFullSyncSec) {
        const status = await syncFromDatastore(datastore, state, { full: true });
        addSyncLogs(pipeline, status, state.lastTickSec);
      } else if (state.lastTickSec > state.nextPartialSyncSec) {
        const status = await syncFromDatastore(datastore, state, { full: false });
        addSyncLogs(pipeline, status, state.lastTickSec);
      }

      // Export to storage.
      if (state.lastTickSec > state.nextArchiveExportSec) {
        await createStateArchive(state, BUCKET_NAME, ARCHIVE_STATE_FOLDER, ARCHIVE_STATE_FILE);
        state.nextArchiveExportSec = state.lastTickSec + EXPORT_ARCHIVE_SEC;
      } else if (state.lastTickSec > state.nextExportSec) {
        const success = await exportToStorage(state, BUCKET_NAME, PERIODIC_STATE_PATH);
        state.nextExportSec = state.lastTickSec + EXPORT_FILE_SEC;
        addExportLogs(pipeline, success, state.lastTickSec);
      }

      await pipeline.execTyped(true);
    }

    // Handle commands received via Redis
    await HandleCommand(redis, state, datastore);
  } catch (e) {
    console.error(`tick: ${e}`);
    console.log(e);
  } finally {
    state.inTick = false;
  }
}

// Update every tick.
async function updateAll(pipeline: RedisClientMultiCmd, state: protos.FetcherState, datastore: Datastore) {
  try {
    await Promise.allSettled([resfreshTrackers(pipeline, state, redis, datastore), resfreshUfoFleets(pipeline, state)]);

    // Create the binary proto output.
    const nowSec = Math.round(Date.now() / 1000);
    const { fullTracksH12, fullTracksH24, fullTracksH48, longIncTracks, shortIncTracks, flymeTracks } =
      createLiveTrackGroups(state, nowSec);

    pipeline
      .set(Keys.fetcherFullProtoH12, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH12)))
      .set(Keys.fetcherFullProtoH24, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH24)))
      .set(Keys.fetcherFullProtoH48, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH48)))
      .set(Keys.fetcherFullNumTracksH12, fullTracksH12.tracks.length)
      .set(Keys.fetcherFullNumTracksH24, fullTracksH24.tracks.length)
      .set(Keys.fetcherFullNumTracksH48, fullTracksH48.tracks.length)
      .set(Keys.fetcherLongIncrementalProto, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(longIncTracks)))
      .set(Keys.fetcherShortIncrementalProto, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(shortIncTracks)))
      .set(Keys.fetcherIncrementalNumTracksLong, longIncTracks.tracks.length)
      .set(Keys.fetcherExportFlymeProto, protoToBuffer(protos.LiveDifferentialTrackGroup.toBinary(flymeTracks)));
  } catch (e) {
    console.log(`tick error ${e}`);
  } finally {
    state.inTick = false;
  }
}

// Export the state on shutdown.
async function shutdown(state: protos.FetcherState) {
  try {
    console.log('Shutdown');
    state.stoppedSec = state.lastTickSec;
    await exportToStorage(state, BUCKET_NAME, SHUTDOWN_STATE_PATH);
  } catch (e) {
    console.error(`storage error: ${e}`);
  }
  await redis.close();
  disconnectOgnClient();
  console.log('Exit...');
  nodeProcess.exit();
}
