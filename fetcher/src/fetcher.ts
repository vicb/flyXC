import { FetcherState } from 'flyxc/common/protos/fetcher-state';
import { LiveDifferentialTrackGroup } from 'flyxc/common/protos/live-track';
import {
  differentialEncodeLiveTrack,
  EXPORT_UPDATE_SEC,
  INCREMENTAL_UPDATE_SEC,
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_AGE_OLD_SEC,
  LIVE_REFRESH_SEC,
  LIVE_RETENTION_SEC,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
  simplifyLiveTrack,
  TrackerIds,
  LIVE_OLD_INTERVAL_SEC,
} from 'flyxc/common/src/live-track';
import { getRedisClient, Keys } from 'flyxc/common/src/redis';
import { Pipeline } from 'ioredis';
import process from 'process';

import { patchLastFixAGL as patchLastFixElevation } from './elevation/elevation';
import { addElevationLogs, addExportLogs, addStateLogs, addSyncLogs, addTrackerLogs, HandleCommand } from './redis';
import { createStateArchive, exportToStorage } from './state/serialize';
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
} from './state/state';
import { syncFromDatastore } from './state/sync';
import { FlymasterFetcher } from './trackers/flymaster';
import { FlymeFetcher } from './trackers/flyme';
import { InreachFetcher } from './trackers/inreach';
import { SkylinesFetcher } from './trackers/skylines';
import { SpotFetcher } from './trackers/spot';
import { TrackerUpdates } from './trackers/tracker';

const redis = getRedisClient();

let state = createInitState();

(async () => {
  await start();
})();

async function start(): Promise<void> {
  state = await restoreState(state);

  const status = await syncFromDatastore(state, { full: true });
  console.log(`State updated from the datastore`, status);

  state.numStarts++;
  state.inTick = false;
  state.numTicks = 0;
  state.reStartedSec = Math.round(Date.now() / 1000);

  console.log(`State last tick ${new Date(state.lastTickSec * 1000)}`);

  tick(state);
  const ticker = setInterval(() => tick(state), LIVE_REFRESH_SEC * 1000);

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, async () => {
      clearInterval(ticker);
      await shutdown(state);
    });
  }
}

async function tick(state: FetcherState) {
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

    await updateTrackers(pipeline, state);

    addStateLogs(pipeline, state);

    if (state.lastTickSec > state.nextFullSyncSec) {
      const status = await syncFromDatastore(state, { full: true });
      addSyncLogs(pipeline, status, state.lastTickSec);
    } else if (state.lastTickSec > state.nextPartialSyncSec) {
      const status = await syncFromDatastore(state, { full: false });
      addSyncLogs(pipeline, status, state.lastTickSec);
    }

    if (state.lastTickSec > state.nextExportSec) {
      const success = await exportToStorage(state, BUCKET_NAME, PERIODIC_STATE_PATH);
      state.nextExportSec = state.lastTickSec + EXPORT_FILE_SEC;
      addExportLogs(pipeline, success, state.lastTickSec);
    }

    if (state.lastTickSec > state.nextArchiveExportSec) {
      await createStateArchive(state, BUCKET_NAME, ARCHIVE_STATE_FOLDER, ARCHIVE_STATE_FILE);
      state.nextArchiveExportSec = state.lastTickSec + EXPORT_ARCHIVE_SEC;
    }

    await pipeline.exec();

    // Handle commands received via Redis
    await HandleCommand(redis, state);
  } catch (e) {
    console.error(`tick: ${e}`);
  } finally {
    state.inTick = false;
  }
}

// Update every tick.
async function updateTrackers(pipeline: Pipeline, state: FetcherState) {
  try {
    const fetchers = [
      new InreachFetcher(state),
      new SpotFetcher(state),
      new SkylinesFetcher(state),
      new FlymeFetcher(state),
      new FlymasterFetcher(state),
    ];

    const updatePromises = await Promise.allSettled(fetchers.map((f) => f.refresh(LIVE_FETCH_TIMEOUT_SEC)));

    const trackerUpdates: TrackerUpdates[] = [];

    for (const p of updatePromises) {
      if (p.status === 'fulfilled') {
        const updates = p.value;
        trackerUpdates.push(updates);
        addTrackerLogs(pipeline, updates, state);
      } else {
        console.error(`Tracker update error: ${p.reason}`);
      }
    }

    const nowSec = Math.round(Date.now() / 1000);
    const fullStartSec = nowSec - LIVE_RETENTION_SEC;
    const incrementalStartSec = nowSec - INCREMENTAL_UPDATE_SEC;
    const exportStartSec = nowSec - EXPORT_UPDATE_SEC;

    // Apply the updates.
    for (const [idStr, pilot] of Object.entries(state.pilots)) {
      const id = Number(idStr);
      // Merge updates
      for (const updates of trackerUpdates) {
        if (updates.trackerDeltas.has(id)) {
          pilot.track = mergeLiveTracks(pilot.track!, updates.trackerDeltas.get(id)!);
        }
      }

      // Trim and simplify
      pilot.track = removeBeforeFromLiveTrack(pilot.track!, fullStartSec);
      simplifyLiveTrack(pilot.track, LIVE_MINIMAL_INTERVAL_SEC);
      // Reduce precision for old point.
      simplifyLiveTrack(pilot.track, LIVE_OLD_INTERVAL_SEC, { toSec: nowSec - LIVE_AGE_OLD_SEC });
    }

    // Add the elevation for the last fix of every tracks when not present.
    const elevationUpdates = await patchLastFixElevation(state);
    addElevationLogs(pipeline, elevationUpdates, state.lastTickSec);

    // Create the binary proto output.
    // TODO: share with flyme
    const fullTracks = LiveDifferentialTrackGroup.create();
    const incTracks = LiveDifferentialTrackGroup.create({ incremental: true });
    const flymeTracks = LiveDifferentialTrackGroup.create();

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
            const flymeTrack = removeDeviceFromLiveTrack(exportTrack, TrackerIds.Flyme);
            if (flymeTrack.timeSec.length > 0) {
              flymeTracks.tracks.push(differentialEncodeLiveTrack(flymeTrack, id, name));
              flymeTracks.remoteId.push(pilot.flyme?.account ?? '');
            }
          }
        }
      }
    }

    pipeline
      .set(Keys.fetcherFullProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(fullTracks)))
      .set(Keys.fetcherFullNumTracks, fullTracks.tracks.length)
      .set(Keys.fetcherIncrementalProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(incTracks)))
      .set(Keys.fetcherIncrementalNumTracks, incTracks.tracks.length)
      .set(Keys.fetcherExportFlymeProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(flymeTracks)));
  } catch (e) {
    console.log(`tick error ${e}`);
  } finally {
    state.inTick = false;
  }
}

async function shutdown(state: FetcherState) {
  try {
    console.log('Shutdown');
    state.stoppedSec = state.lastTickSec;
    await exportToStorage(state, BUCKET_NAME, SHUTDOWN_STATE_PATH);
  } catch (e) {
    console.error(`storage error: ${e}`);
  }
  await redis.quit();
  console.log('Exit...');
  process.exit();
}
