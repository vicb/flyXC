import type { protos } from '@flyxc/common';

import { environment } from '../../environments/environment.prod';
import { importFromStorage } from './serialize';

export const BUCKET_NAME = 'fly-xc.appspot.com';

// Update the state version when the shape change (i.e. proto).
const STATE_FOLDER = environment.production ? 'fetcher' : 'fetcher.dev';

const STATE_VERSION = 1;
export const PERIODIC_STATE_PATH = `${STATE_FOLDER}/state_v${STATE_VERSION}.brotli`;
export const SHUTDOWN_STATE_PATH = `${STATE_FOLDER}/state_v${STATE_VERSION}.shutdown.brotli`;

export const ARCHIVE_STATE_FOLDER = `${STATE_FOLDER}/archive`;
export const ARCHIVE_STATE_FILE = `YYYY-MM-DD/state_v${STATE_VERSION}.brotli`;

export const EXPORT_FILE_SEC = 4 * 3600;
export const EXPORT_ARCHIVE_SEC = 24 * 3600;
export const FULL_SYNC_SEC = 24 * 3600;
export const PARTIAL_SYNC_SEC = 10 * 60;

// Create the initial empty state.
export function createInitState(): protos.FetcherState {
  const nowSec = Math.round(Date.now() / 1000);

  return {
    version: 1,
    nodeVersion: '',

    startedSec: nowSec,
    reStartedSec: nowSec,
    stoppedSec: 0,
    nextStopSec: 0,
    lastTickSec: 0,
    numTicks: 0,
    numStarts: 0,

    lastUpdatedMs: 0,

    nextPartialSyncSec: nowSec + PARTIAL_SYNC_SEC,
    nextFullSyncSec: nowSec + FULL_SYNC_SEC,
    nextExportSec: nowSec + EXPORT_FILE_SEC,
    nextArchiveExportSec: nowSec + EXPORT_ARCHIVE_SEC,
    // BMAC supporters sync disabled (API is no longer available).
    nextSupporterSyncSec: 0,

    memRssMb: 0,
    memHeapMb: 0,

    inTick: false,
    pilots: {},
    ufoFleets: {},
  };
}

// Restore the state from periodic or shutdown exports.
//
// Returns the passed state when no serialized state is found.
export async function restoreState(state: protos.FetcherState): Promise<protos.FetcherState> {
  const states: protos.FetcherState[] = [];

  try {
    states.push(await importFromStorage(BUCKET_NAME, PERIODIC_STATE_PATH));
  } catch (e) {
    console.log(`Can not restore periodic state`);
  }

  try {
    states.push(await importFromStorage(BUCKET_NAME, SHUTDOWN_STATE_PATH));
  } catch (e) {
    console.log(`Can not restore shutdown state`);
  }

  // Use the most recent state.
  if (states.length > 0) {
    let index = 0;
    let maxTickSec = states[0].lastTickSec;
    for (let i = 1; i < states.length; i++) {
      if (states[i].lastTickSec > maxTickSec) {
        index = i;
        maxTickSec = states[i].lastTickSec;
      }
    }
    return states[index];
  }

  return state;
}
