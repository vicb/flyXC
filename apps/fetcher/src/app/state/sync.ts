import type { LiveTrackEntity, TrackerNames } from '@flyxc/common';
import {
  LIVE_REFRESH_SEC,
  protos,
  trackerNames,
  trackerValidators,
  validateFlymeAccount,
  validateZoleoAccount,
} from '@flyxc/common';
import { LIVE_TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { RunQueryResponse } from '@google-cloud/datastore/build/src/query';

import { FULL_SYNC_SEC, PARTIAL_SYNC_SEC } from './state';

const BATCH_SIZE = 50;

export interface SyncStatus {
  full: boolean;
  errors: string[];
  numSync: number;
  numDeleted: number;
}

// Update the state from the Datastore.
//
// When full is:
// - true: full sync, everything is synced,
// - false: only sync entity updated since last sync.
export async function syncFromDatastore(
  datastore: Datastore,
  state: protos.FetcherState,
  { full }: { full: boolean } = { full: false },
): Promise<SyncStatus> {
  const status: SyncStatus = {
    full,
    numSync: 0,
    numDeleted: 0,
    errors: [],
  };
  try {
    const query = datastore.createQuery(LIVE_TRACK_TABLE).limit(BATCH_SIZE);

    if (!full) {
      // Partial syncs only start after the last sync.
      query.filter('updated', '>', new Date(state.lastUpdatedMs));
    }
    const syncedId = new Set<string>();

    let start: string | undefined;
    let results: RunQueryResponse | undefined;

    do {
      if (start) {
        query.start(start);
      }

      results = await datastore.runQuery(query);

      for (const liveTrack of results[0]) {
        const id = liveTrack[Datastore.KEY].id;
        if (id !== null) {
          syncedId.add(id);
          syncLiveTrack(state, liveTrack);
        }
      }

      start = results[1].endCursor;
    } while (results[1].moreResults != datastore.NO_MORE_RESULTS);

    status.numSync = syncedId.size;

    // Delete unseen ids on full sync.
    if (full) {
      for (const id of Object.keys(state.pilots)) {
        if (!syncedId.has(id)) {
          status.numDeleted++;
          delete state.pilots[id];
        }
      }
    }

    // Update next sync
    const nowSec = Math.round(Date.now() / 1000);
    if (full) {
      state.nextFullSyncSec = nowSec + FULL_SYNC_SEC;
    }
    // No need for a partial sync after a full sync.
    state.nextPartialSyncSec = nowSec + PARTIAL_SYNC_SEC;
  } catch (e) {
    status.errors.push(`${e}`);
  }
  return status;
}

// Updates the state with the passed live track.
//
// The state is mutated.
export function syncLiveTrack(state: protos.FetcherState, liveTrack: LiveTrackEntity) {
  const id = liveTrack[Datastore.KEY].id;

  if (id == null) {
    console.error(`syncLiveTrack: entity has no id`);
    return;
  }

  const updatedPilot = createPilotFromEntity(liveTrack);
  const existingPilot = state.pilots[id];

  if (existingPilot != null) {
    // Preserve the track only when no configs have changed.
    let preserveTrack = updatedPilot.enabled == existingPilot.enabled;

    for (const tracker of trackerNames) {
      const updatedTracker = updatedPilot[tracker];
      const existingTracker = existingPilot[tracker];
      if (existingTracker == null || updatedTracker == null) {
        // When the existing tracker is null we want to use the updatedPilot.
        // When the updated pilot is null we want to use it.
        continue;
      }
      const updated =
        updatedTracker.enabled !== existingTracker.enabled || updatedTracker.account !== existingTracker.account;
      if (updated) {
        // Invalidate the track when the settings have been updated.
        preserveTrack = false;
      } else {
        // The settings have not changed, re-use the other properties (last fix, next fetch, ...).
        updatedPilot[tracker] = existingTracker;
      }
    }

    if (preserveTrack) {
      updatedPilot.track = existingPilot.track;
    }
  }

  state.pilots[id] = updatedPilot;
  const pilotUpdatedMs = Math.round(liveTrack.updated.getTime());
  state.lastUpdatedMs = Math.max(state.lastUpdatedMs, pilotUpdatedMs);
}

// Creates a pilot from a Live Track datastore entity.
function createPilotFromEntity(liveTrack: LiveTrackEntity): protos.Pilot {
  // flyme is different as we validate account_resolved.
  const flyme = createDefaultTracker();
  if (liveTrack.flyme) {
    const id = validateFlymeAccount(liveTrack.flyme.account_resolved ?? '');
    if (id != false) {
      flyme.enabled = liveTrack.flyme.enabled;
      flyme.account = id;
    }
  }

  const zoleo = createDefaultTracker();
  if (liveTrack.zoleo) {
    const imei = validateZoleoAccount(liveTrack.zoleo.imei ?? '');
    if (imei != false) {
      zoleo.enabled = liveTrack.zoleo.enabled;
      zoleo.account = liveTrack.zoleo.imei;
    }
  }

  return {
    name: liveTrack.name,
    track: protos.LiveTrack.create(),
    share: liveTrack.share,
    enabled: liveTrack.enabled,
    flyme,
    ...createAccountEnabledTracker('inreach', liveTrack),
    ...createAccountEnabledTracker('spot', liveTrack),
    ...createAccountEnabledTracker('skylines', liveTrack),
    ...createAccountEnabledTracker('flymaster', liveTrack),
    ...createAccountEnabledTracker('ogn', liveTrack),
    zoleo,
    ...createAccountEnabledTracker('xcontest', liveTrack),
    ...createAccountEnabledTracker('meshbir', liveTrack),
  };
}

// Create a tracker that has both account and enabled properties.
function createAccountEnabledTracker<T extends TrackerNames>(
  name: T,
  liveTrack: LiveTrackEntity,
): { [k in T]: protos.Tracker } {
  const tracker = createDefaultTracker();
  if (liveTrack[name] != null) {
    const validators = trackerValidators[name];
    if (validators.length != 1) {
      throw new Error(`Invalid validator`);
    }
    const validator = validators[0].callback;
    const id = validator(liveTrack[name].account);
    if (id != false) {
      tracker.enabled = liveTrack[name].enabled;
      tracker.account = id;
    }
  }
  return { [name]: tracker } as any;
}

// Creates a tracker.
function createDefaultTracker(): protos.Tracker {
  const nowSec = Math.round(Date.now() / 1000);
  return {
    enabled: false,
    account: '',
    // Set to 0 to fetch the most history on the first tick.
    lastFetchSec: 0,
    // Fetching is throttled when the last fix is too old. 1 day is ok.
    lastFixSec: nowSec - 24 * 3600,
    // Start next fetch randomly over the next few ticks.
    nextFetchSec: nowSec + LIVE_REFRESH_SEC * Math.round(Math.random() * 10),
    // Starting without errors.
    numErrors: 0,
    numRequests: 0,
    numConsecutiveErrors: 0,
  };
}
