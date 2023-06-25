import {
  differentialEncodeLiveTrack,
  EXPORT_UPDATE_SEC,
  INCREMENTAL_UPDATE_SEC,
  Keys,
  LIVE_REFRESH_SEC,
  protos,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
} from '@flyxc/common';
import { getDatastore, getRedisClient } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import { program } from 'commander';
import { ChainableCommander } from 'ioredis';
import process from 'process';
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
import { disconnectOgnClient, resfreshTrackers } from './app/trackers/refresh';
import { resfreshUfoFleets } from './app/ufos/refresh';

const redis = getRedisClient();

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

  state.nodeVersion = process.version;
  state.numStarts++;
  state.inTick = false;
  state.numTicks = 0;
  state.reStartedSec = Math.round(Date.now() / 1000);
  state.nextStopSec = exitAfterSec == 0 ? 0 : exitAfterSec + Math.round(Date.now() / 1000);

  console.log(`State last tick ${new Date(state.lastTickSec * 1000)}`);

  tick(state, datastore);
  const ticker = setInterval(() => tick(state, datastore), LIVE_REFRESH_SEC * 1000);

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, async () => {
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
    const memory = process.memoryUsage();
    state.memHeapMb = Math.round(memory.heapTotal / 1e6);
    state.memRssMb = Math.round(memory.rss / 1e6);

    const pipeline = redis.pipeline();

    await updateAll(pipeline, state, datastore);

    addStateLogs(pipeline, state);
    await addHostInfo(pipeline);

    if (state.nextStopSec > 0 && state.lastTickSec > state.nextStopSec) {
      // We do not need to sync on shutdown as there will be a sync on startup.
      await pipeline.exec();
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

      await pipeline.exec();
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
async function updateAll(pipeline: ChainableCommander, state: protos.FetcherState, datastore: Datastore) {
  try {
    await Promise.allSettled([resfreshTrackers(pipeline, state, redis, datastore), resfreshUfoFleets(pipeline, state)]);

    const nowSec = Math.round(Date.now() / 1000);
    const incrementalStartSec = nowSec - INCREMENTAL_UPDATE_SEC;
    const exportStartSec = nowSec - EXPORT_UPDATE_SEC;

    // Create the binary proto output.
    const fullTracks = protos.LiveDifferentialTrackGroup.create();
    const incTracks = protos.LiveDifferentialTrackGroup.create({ incremental: true });
    const flymeTracks = protos.LiveDifferentialTrackGroup.create();

    for (const [idStr, pilot] of Object.entries(state.pilots)) {
      const id = Number(idStr);
      // Add to group
      const name = pilot.name || 'unknown';
      if (pilot.track!.timeSec.length > 0) {
        fullTracks.tracks.push(differentialEncodeLiveTrack(pilot.track!, id, name));

        const incTrack = removeBeforeFromLiveTrack(pilot.track!, incrementalStartSec);
        if (incTrack.timeSec.length > 0) {
          incTracks.tracks.push(differentialEncodeLiveTrack(incTrack, id, name));
        }

        if (pilot.share) {
          const exportTrack = removeBeforeFromLiveTrack(incTrack, exportStartSec);
          if (exportTrack.timeSec.length > 0) {
            const flymeTrack = removeDeviceFromLiveTrack(exportTrack, 'flyme');
            if (flymeTrack.timeSec.length > 0) {
              flymeTracks.tracks.push(differentialEncodeLiveTrack(flymeTrack, id, name));
              flymeTracks.remoteId.push(pilot.flyme?.account ?? '');
            }
          }
        }
      }
    }

    for (const [name, fleet] of Object.entries(state.ufoFleets)) {
      for (const [idStr, track] of Object.entries(fleet.ufos)) {
        const id = `${name}-${idStr}`;
        fullTracks.tracks.push(differentialEncodeLiveTrack(track, id));
        const incTrack = removeBeforeFromLiveTrack(track, incrementalStartSec);
        if (incTrack.timeSec.length > 0) {
          incTracks.tracks.push(differentialEncodeLiveTrack(incTrack, id));
        }
      }
    }

    pipeline
      .set(Keys.fetcherFullProto, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(fullTracks)))
      .set(Keys.fetcherFullNumTracks, fullTracks.tracks.length)
      .set(Keys.fetcherIncrementalProto, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(incTracks)))
      .set(Keys.fetcherIncrementalNumTracks, incTracks.tracks.length)
      .set(Keys.fetcherExportFlymeProto, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(flymeTracks)));
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
  await redis.quit();
  disconnectOgnClient();
  console.log('Exit...');
  process.exit();
}
