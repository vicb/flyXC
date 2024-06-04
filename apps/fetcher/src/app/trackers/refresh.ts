import type { protos } from '@flyxc/common';
import {
  Keys,
  LIVE_AGE_OLD_SEC,
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_OLD_INTERVAL_SEC,
  LIVE_TRACKER_RETENTION_SEC,
  SecretKeys,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
} from '@flyxc/common';
import { pushListCap } from '@flyxc/common-node';
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

const ognClient = new OgnClient(OGN_HOST, OGN_PORT, SecretKeys.APRS_USER, SecretKeys.APRS_PASSWORD);

export function disconnectOgnClient() {
  ognClient.disconnect();
}

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
  const fullStartSec = nowSec - LIVE_TRACKER_RETENTION_SEC;

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
  const elevationUpdates = await patchLastFixAGL(state);
  addElevationLogs(pipeline, elevationUpdates, state.lastTickSec);
}

// Logs updates for a tracker type.
export function addTrackerLogs(
  pipeline: ChainableCommander,
  updates: TrackerUpdates,
  state: protos.FetcherState,
): void {
  const name = updates.name;
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
    const numConsErrors = state.pilots[id][name].numConsecutiveErrors;
    if (numConsErrors > 10) {
      pushListCap(
        pipeline,
        Keys.trackerConsecutiveErrorsById.replace('{name}', name),
        [`[${time}] id=${id} ${error}`],
        20,
      );
    }
    const numErrors = state.pilots[id][name].numErrors;
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
