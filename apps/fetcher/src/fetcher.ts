import process from 'node:process';

import {
  differentialEncodeLiveTrack,
  Keys,
  LIVE_REFRESH_SEC,
  LiveDataRetentionSec,
  protos,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
} from '@flyxc/common';
import { getDatastore, getRedisClient, pushListCap } from '@flyxc/common-node';
import { Secrets } from '@flyxc/secrets';
import type { Datastore } from '@google-cloud/datastore';
import { program } from 'commander';
import type { ChainableCommander } from 'ioredis';

import { fetchSupporters } from './app/misc/buy-coffee';
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
  SUPPORTER_SYNC_SEC,
} from './app/state/state';
import { syncFromDatastore } from './app/state/sync';
import { disconnectOgnClient, resfreshTrackers } from './app/trackers/refresh';
import { resfreshUfoFleets } from './app/ufos/refresh';

const redis = getRedisClient(Secrets.REDIS_URL);

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

      // Sync supporters.
      if (state.lastTickSec > state.nextSupporterSyncSec) {
        const supporters = await fetchSupporters();
        pipeline
          .del(Keys.supporterNames)
          .set(Keys.supporterNum, supporters.numSupporters)
          .set(Keys.supporterAmount, supporters.totalAmount);
        pushListCap(pipeline, Keys.supporterNames, Array.from(supporters.names), 50, 50);

        state.nextSupporterSyncSec = state.lastTickSec + SUPPORTER_SYNC_SEC;
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

    // Create the binary proto output.
    const fullTracksH12 = protos.LiveDifferentialTrackGroup.create();
    const fullTracksH24 = protos.LiveDifferentialTrackGroup.create();
    const fullTracksH48 = protos.LiveDifferentialTrackGroup.create();
    const longIncTracks = protos.LiveDifferentialTrackGroup.create({ incremental: true });
    const shortIncTracks = protos.LiveDifferentialTrackGroup.create({ incremental: true });
    const flymeTracks = protos.LiveDifferentialTrackGroup.create();

    // Add pilots.
    for (const [idStr, pilot] of Object.entries(state.pilots)) {
      const id = Number(idStr);
      // Add to group
      const name = pilot.name || 'unknown';
      if (pilot.track.timeSec.length > 0) {
        fullTracksH48.tracks.push(differentialEncodeLiveTrack(pilot.track, id, name));
        const fullH24 = maybePushTrack(fullTracksH24, pilot.track, nowSec - LiveDataRetentionSec.FullH24, idStr, name);
        const fullH12 = maybePushTrack(fullTracksH12, fullH24, nowSec - LiveDataRetentionSec.FullH12, idStr, name);

        const longInc = maybePushTrack(
          longIncTracks,
          fullH12,
          nowSec - LiveDataRetentionSec.IncrementalLong,
          idStr,
          name,
        );
        maybePushTrack(shortIncTracks, longInc, nowSec - LiveDataRetentionSec.IncrementalShort, idStr, name);

        if (pilot.share) {
          const flymeTrack = removeDeviceFromLiveTrack(fullH12, 'flyme');
          maybePushTrack(flymeTracks, flymeTrack, nowSec - LiveDataRetentionSec.ExportToPartners, idStr, name);
        }
      }
    }

    // Add UFOs.
    for (const [name, fleet] of Object.entries(state.ufoFleets)) {
      for (const [idStr, track] of Object.entries(fleet.ufos)) {
        const id = `${name}-${idStr}`;
        fullTracksH48.tracks.push(differentialEncodeLiveTrack(track, id));

        const fullH24 = maybePushTrack(fullTracksH24, track, nowSec - LiveDataRetentionSec.FullH24, id);
        const fullH12 = maybePushTrack(fullTracksH12, fullH24, nowSec - LiveDataRetentionSec.FullH12, id);

        const longInc = maybePushTrack(longIncTracks, fullH12, nowSec - LiveDataRetentionSec.IncrementalLong, id);
        maybePushTrack(shortIncTracks, longInc, nowSec - LiveDataRetentionSec.IncrementalShort, id);
      }
    }

    pipeline
      .set(Keys.fetcherFullProtoH12, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH12)))
      .set(Keys.fetcherFullProtoH24, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH24)))
      .set(Keys.fetcherFullProtoH48, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(fullTracksH48)))
      .set(Keys.fetcherFullNumTracksH12, fullTracksH12.tracks.length)
      .set(Keys.fetcherFullNumTracksH24, fullTracksH24.tracks.length)
      .set(Keys.fetcherFullNumTracksH48, fullTracksH48.tracks.length)
      .set(Keys.fetcherLongIncrementalProto, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(longIncTracks)))
      .set(Keys.fetcherShortIncrementalProto, Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(shortIncTracks)))
      .set(Keys.fetcherIncrementalNumTracksLong, longIncTracks.tracks.length)
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

/**
 * Conditionally adds a live track to a track group after removing outdated points.
 *
 * @param dstTracks - The destination track group to potentially add the track to.
 * @param track - The live track to be processed and potentially added.
 * @param dropBeforeSec - The timestamp in seconds to drop points before.
 * @param id - The identifier for the track.
 * @param name - The name associated with the track.
 * @returns The processed live track after removing outdated points.
 */
function maybePushTrack(
  dstTracks: protos.LiveDifferentialTrackGroup,
  track: protos.LiveTrack,
  dropBeforeSec: number,
  id: string,
  name?: string,
) {
  track = removeBeforeFromLiveTrack(track, dropBeforeSec);
  if (track.timeSec.length > 0) {
    dstTracks.tracks.push(differentialEncodeLiveTrack(track, id, name));
  }
  return track;
}
