import type { protos } from '@flyxc/common';
import {
  Keys,
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_UFO_RETENTION_SEC,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
} from '@flyxc/common';
import { pushListCap } from '@flyxc/common-node';
import type { ChainableCommander } from 'ioredis';
import { AviantFetcher } from './aviant';
import type { UfoFleetUpdates } from './ufo';

export async function resfreshUfoFleets(pipeline: ChainableCommander, state: protos.FetcherState) {
  const fetchers = [new AviantFetcher(state, pipeline)];

  const updatePromises = await Promise.allSettled(fetchers.map((f) => f.refresh(LIVE_FETCH_TIMEOUT_SEC)));

  const fleetUpdates: UfoFleetUpdates[] = [];

  for (const p of updatePromises) {
    if (p.status === 'fulfilled') {
      const updates = p.value;
      fleetUpdates.push(updates);
      addUfoFleetLogs(pipeline, updates, state);
    } else {
      console.error(`Ufos update error: ${p.reason}`);
    }
  }

  const nowSec = Math.round(Date.now() / 1000);
  const ufoStartSec = nowSec - LIVE_UFO_RETENTION_SEC;

  for (const fleetUpdate of fleetUpdates) {
    const fleetName = fleetUpdate.fleetName;
    const ufoTracks = state.ufoFleets[fleetName].ufos ?? {};

    for (const [id, livetrack] of fleetUpdate.deltas.entries()) {
      if (ufoTracks[id] != null) {
        ufoTracks[id] = mergeLiveTracks(ufoTracks[id], livetrack);
      } else {
        ufoTracks[id] = livetrack;
      }
    }

    // eslint-disable-next-line prefer-const
    for (let [id, track] of Object.entries(ufoTracks)) {
      simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
      track = removeBeforeFromLiveTrack(track, ufoStartSec);
      if (track.timeSec.length == 0) {
        delete ufoTracks[id];
      }
    }
  }
}

export function addUfoFleetLogs(
  pipeline: ChainableCommander,
  updates: UfoFleetUpdates,
  _state: protos.FetcherState,
): void {
  const name = updates.fleetName;
  const time = updates.startFetchSec;

  pushListCap(
    pipeline,
    Keys.trackerErrorsByType.replace('{name}', name),
    updates.errors.map((e) => `[${time}] ${e}`),
    20,
  );
  pushListCap(pipeline, Keys.trackerNumUpdates.replace('{name}', name), [updates.deltas.size], 20);
  pushListCap(
    pipeline,
    Keys.trackerFetchDuration.replace('{name}', name),
    [updates.endFetchSec - updates.startFetchSec],
    20,
  );
}
