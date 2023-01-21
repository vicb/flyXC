import {
  LiveTrackEntity,
  LIVE_REFRESH_SEC,
  protos,
  trackerNames,
  validateFlymasterAccount,
  validateFlymeAccount,
  validateInreachAccount,
  validateSkylinesAccount,
  validateSpotAccount,
} from '@flyxc/common';
import { LIVE_TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import { RunQueryResponse } from '@google-cloud/datastore/build/src/query';
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
    if (full == true) {
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
    console.error(`syncToState: entity has no id`);
    return;
  }

  const pilot = createPilotFromEntity(liveTrack);
  const statePilot = state.pilots[id];

  if (statePilot != null) {
    // Preserve the track only when no configs have changed.
    let preserveTrack = pilot.enabled == state.pilots[id].enabled;

    for (const propName of trackerNames) {
      const tracker = pilot[propName];
      const stateTracker = statePilot[propName];
      const updated = tracker.enabled !== stateTracker.enabled || tracker.account !== stateTracker.account;
      if (updated) {
        // Invalidate the track when the settings have been updated.
        preserveTrack = false;
      } else {
        // The settings have not changed, re-use the other properties (last fix, next fetch, ...).
        pilot[propName] = stateTracker;
      }
    }

    if (preserveTrack) {
      pilot.track = statePilot.track;
    }
  }

  state.pilots[id] = pilot;
  const pilotUpdatedMs = Math.round(liveTrack.updated.getTime());
  state.lastUpdatedMs = Math.max(state.lastUpdatedMs, pilotUpdatedMs);
}

// Creates a pilot from a Live Track datastore entity.
function createPilotFromEntity(liveTrack: LiveTrackEntity): protos.Pilot {
  const e = liveTrack;

  const inreach = createDefaultTracker();
  if (e.inreach) {
    const account = validateInreachAccount(e.inreach.account);
    if (account != false) {
      inreach.enabled = e.inreach.enabled;
      inreach.account = account;
    }
  }

  const spot = createDefaultTracker();
  if (e.spot) {
    const account = validateSpotAccount(e.spot.account);
    if (account != false) {
      spot.enabled = e.spot.enabled;
      spot.account = account;
    }
  }

  const skylines = createDefaultTracker();
  if (e.skylines) {
    const account = validateSkylinesAccount(e.skylines.account);
    if (account != false) {
      skylines.enabled = e.skylines.enabled;
      skylines.account = account;
    }
  }

  const flymaster = createDefaultTracker();
  if (e.flymaster) {
    const account = validateFlymasterAccount(e.flymaster.account);
    if (account != false) {
      flymaster.enabled = e.flymaster.enabled;
      flymaster.account = account;
    }
  }

  const flyme = createDefaultTracker();
  if (e.flyme) {
    const id = validateFlymeAccount(e.flyme.account_resolved ?? '');
    if (id != false) {
      flyme.enabled = e.flyme.enabled;
      flyme.account = id;
    }
  }

  return {
    name: e.name,
    track: protos.LiveTrack.create(),
    share: e.share,
    enabled: e.enabled,
    inreach,
    spot,
    flyme,
    skylines,
    flymaster,
  };
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
