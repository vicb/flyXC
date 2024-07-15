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
import { pushListCap } from '@flyxc/common-node';
import { Secrets } from '@flyxc/secrets';
import type { Datastore } from '@google-cloud/datastore';
import type { ChainableCommander, Redis } from 'ioredis';

import { patchLastFixAGL } from '../elevation/elevation';
import { addElevationLogs } from '../redis';
import { FlymasterFetcher } from './flymaster';
import { FlymeFetcher } from './flyme';
import { InreachFetcher } from './inreach';
import { OgnFetcher } from './ogn';
import { OGN_HOST, OGN_PORT, OgnClient } from './ogn-client';
import { SkylinesFetcher } from './skylines';
import { SpotFetcher } from './spot';
import type { TrackerUpdates } from './tracker';
import { XcontestFetcher } from './xcontest';
import { ZoleoFetcher } from './zoleo';

const ognClient = new OgnClient(OGN_HOST, OGN_PORT, Secrets.APRS_USER, Secrets.APRS_PASSWORD);

export function disconnectOgnClient() {
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
  pipeline: ChainableCommander,
  state: protos.FetcherState,
  redis: Redis,
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
  const dropBeforeSec = nowSec - LiveDataRetentionSec.Max;

  // Apply the updates.
  for (const [idStr, pilot] of Object.entries(state.pilots)) {
    const id = Number(idStr);
    // Merge updates
    for (const updates of trackerUpdates) {
      if (updates.trackerDeltas.has(id)) {
        pilot.track = mergeLiveTracks(pilot.track, updates.trackerDeltas.get(id));
      }
    }

    // Remove outdated points
    pilot.track = removeBeforeFromLiveTrack(pilot.track, dropBeforeSec);

    // Decimates points according to their age.
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

  // Add the elevation for the last fix of every tracks when not present.
  const elevationUpdates = await patchLastFixAGL(state);
  addElevationLogs(pipeline, elevationUpdates, state.lastTickSec);
}

// Logs updates for a tracker type.
export function addTrackerLogs(
  pipeline: ChainableCommander,
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
