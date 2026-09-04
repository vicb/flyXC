import type { protos } from '@flyxc/common';
import {
  Keys,
  LIVE_FETCH_TIMEOUT_SEC,
  LiveDataIntervalSec,
  LiveDataRetentionSec,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
} from '@flyxc/common';
import type { RedisClient, RedisClientMultiCmd } from '@flyxc/common-node';
import { pushListCap } from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';

import { patchLastFixAGL } from '../elevation/elevation';
import { addElevationLogs } from '../redis';
import { FlymasterFetcher } from './flymaster';
import { FlymeFetcher } from './flyme';
import { InreachFetcher } from './inreach';
import { MeshBirFetcher } from './meshbir';
import { OgnFetcher } from './ogn';
import { OGN_HOST, OGN_PORT, OgnClient } from './ogn-client';
import { SkylinesFetcher } from './skylines';
import { SpotFetcher } from './spot';
import type { TrackerUpdates } from './tracker';
import { XcontestFetcher } from './xcontest';
import { ZoleoFetcher } from './zoleo';

const ognClient = new OgnClient(OGN_HOST, OGN_PORT, SECRETS.APRS_USER, SECRETS.APRS_PASSWORD);

/**
 * Disconnects the OGN APRS client.
 */
export function disconnectOgnClient(): void {
  ognClient.disconnect();
}

/**
 * Refreshes all the trackers.
 *
 * Process:
 * - fetch live data
 * - update tracks (remove outdated point, decimates point according to their age),
 * - add elevation information.
 *
 * @param pipeline - The ChainableCommander instance for executing commands.
 * @param state - The FetcherState object containing current state information.
 * @param redis - The Redis client for caching data.
 * @param datastore - The Datastore instance for storing data.
 */
export async function resfreshTrackers(
  pipeline: RedisClientMultiCmd,
  state: protos.FetcherState,
  redis: RedisClient,
  datastore: Datastore,
) {
  const fetchers = [
    new InreachFetcher(state, pipeline),
    new SpotFetcher(state, pipeline),
    new SkylinesFetcher(state, pipeline),
    new FlymeFetcher(state, pipeline),
    new FlymasterFetcher(state, pipeline),
    new OgnFetcher(ognClient, state, pipeline),
    new ZoleoFetcher(state, pipeline, redis, datastore),
    new XcontestFetcher(state, pipeline),
    new MeshBirFetcher(state, pipeline, redis),
  ];

  const fetchResults = await Promise.allSettled(fetchers.map((f) => f.refresh(LIVE_FETCH_TIMEOUT_SEC)));

  const trackerUpdates: TrackerUpdates[] = [];

  for (const result of fetchResults) {
    if (result.status === 'fulfilled') {
      const updates = result.value;
      trackerUpdates.push(updates);
      addTrackerLogs(pipeline, updates, state);
    } else {
      console.error(`Tracker update error: ${result.reason}`);
    }
  }

  // Drop points older than the max retention.
  const nowSec = Math.round(Date.now() / 1000);

  // Apply the updates.
  const updatedPilotIds = applyTrackerUpdates(state, trackerUpdates, nowSec);

  // Add the elevation for the last fix of every tracks when not present.
  const elevationUpdates = await patchLastFixAGL(state, updatedPilotIds);
  addElevationLogs(pipeline, elevationUpdates, state.lastTickSec);
}

/**
 * Applies tracker updates to the pilots in state:
 * - Merges incoming tracker deltas only for updated pilots.
 * - Drops points older than max retention for all tracks.
 * - Decimates/simplifies only the tracks of pilots that were updated in this cycle.
 *
 * @param state - The FetcherState object containing current state information.
 * @param trackerUpdates - Array of updates from tracker fetches.
 * @param nowSec - Current timestamp in seconds (defaults to now).
 */
export function applyTrackerUpdates(
  state: protos.FetcherState,
  trackerUpdates: TrackerUpdates[],
  nowSec = Math.round(Date.now() / 1000),
): Set<number> {
  const dropBeforeSec = nowSec - LiveDataRetentionSec.Max;

  // Merge updates only for pilots that have deltas in this cycle.
  const updatedPilotIds = new Set<number>();
  for (const updates of trackerUpdates) {
    for (const [id, delta] of updates.trackerDeltas.entries()) {
      const pilot = state.pilots[id];
      if (pilot) {
        pilot.track = mergeLiveTracks(pilot.track, delta);
        updatedPilotIds.add(id);
      }
    }
  }

  // Drop points older than max retention for all tracks that have outdated points.
  for (const pilot of Object.values(state.pilots)) {
    if (pilot.track.timeSec.length > 0 && pilot.track.timeSec[0] < dropBeforeSec) {
      pilot.track = removeBeforeFromLiveTrack(pilot.track, dropBeforeSec);
    }
  }

  // Only simplify and decimate tracks for pilots that were updated in the current cycle.
  for (const id of updatedPilotIds) {
    const pilot = state.pilots[id];
    if (pilot) {
      simplifyLiveTrack(pilot.track, LiveDataIntervalSec.AfterH24, {
        toSec: nowSec - 24 * 3600,
      });
      simplifyLiveTrack(pilot.track, LiveDataIntervalSec.H12ToH24, {
        fromSec: nowSec - 24 * 3600,
        toSec: nowSec - 12 * 3600,
      });
      simplifyLiveTrack(pilot.track, LiveDataIntervalSec.H6ToH12, {
        fromSec: nowSec - 12 * 3600,
        toSec: nowSec - 6 * 3600,
      });
      simplifyLiveTrack(pilot.track, LiveDataIntervalSec.Recent, {
        fromSec: nowSec - 6 * 3600,
      });
    }
  }
  return updatedPilotIds;
}

/**
 * Logs updates for a tracker type.
 *
 * @param pipeline - Redis multi command pipeline.
 * @param updates - Updates from the tracker fetch.
 * @param state - Current fetcher state.
 */
export function addTrackerLogs(
  pipeline: RedisClientMultiCmd,
  updates: TrackerUpdates,
  state: protos.FetcherState,
): void {
  const { name, startFetchSec } = updates;

  pushListCap(
    pipeline,
    Keys.trackerErrorsByType.replace('{name}', name),
    updates.errors.map((e) => `[${startFetchSec}] ${e}`),
    20,
  );
  pushListCap(
    pipeline,
    Keys.trackerErrorsById.replace('{name}', name),
    [...updates.trackerErrors.entries()].map(([id, e]) => `[${startFetchSec}] id=${id} ${e}`),
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
    const numConsErrors = state.pilots[id][name].numConsecutiveErrors;
    if (numConsErrors > 10) {
      pushListCap(
        pipeline,
        Keys.trackerConsecutiveErrorsById.replace('{name}', name),
        [`[${startFetchSec}] id=${id} ${error}`],
        20,
      );
    }
    const { numErrors } = state.pilots[id][name];
    if (numErrors > 300) {
      pushListCap(
        pipeline,
        Keys.trackerManyErrorsById.replace('{name}', name),
        [`[${startFetchSec}] id=${id} ${numErrors} errors`],
        20,
      );
    }
  }
}
