import * as protos from 'flyxc/common/protos/live-track';
import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  getTrackerFlags as getLiveTrackFlags,
  LIVE_RETENTION_SEC,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  trackerDisplayNames,
  TrackerIds,
  trackerPropNames,
} from 'flyxc/common/src/live-track';
import { LIVE_TRACK_TABLE, LiveTrackEntity, TrackerEntity } from 'flyxc/common/src/live-track-entity';
import { round } from 'flyxc/common/src/math';
import { getDistance } from 'geolib';

import { Datastore, Key } from '@google-cloud/datastore';

import * as flyme from './flyme';
import * as inreach from './inreach';
import * as skylines from './skylines';
import * as spot from './spot';

// TODO: one instance ?
const datastore = new Datastore();

export interface LivePoint {
  lat: number;
  lon: number;
  alt: number;
  // Timestamps in milliseconds.
  timestamp: number;
  device: TrackerIds;
  // Whether the gps fix is invalid.
  // undefined or null is considered valid (only false is invalid).
  valid?: boolean | null;

  // Optional fields.
  emergency?: boolean | null;
  message?: string | null;
  // Speed in km/h.
  speed?: number | null;
  lowBattery?: boolean | null;
}

// Makes a track for a list of points.
// The track is in chronological order (oldest point first).
export function makeLiveTrack(points: LivePoint[]): protos.LiveTrack {
  points.sort((a, b) => a.timestamp - b.timestamp);

  const track = protos.LiveTrack.create();

  points.forEach((point, index) => {
    track.lat.push(round(point.lat, 5));
    track.lon.push(round(point.lon, 5));
    track.alt.push(Math.round(point.alt));
    track.timeSec.push(Math.round(point.timestamp / 1000));
    track.flags.push(
      getLiveTrackFlags({
        valid: point.valid !== false,
        emergency: point.emergency === true,
        lowBat: point.lowBattery === true,
        device: point.device,
      }),
    );
    let hasExtra = false;
    const extra: protos.LiveExtra = {};
    if (point.speed != null) {
      extra.speed = round(point.speed, 1);
      hasExtra = true;
    }
    if (point.message != null) {
      extra.message = point.message;
      hasExtra = true;
    }
    if (hasExtra) {
      track.extra[index] = extra;
    }
  });

  // Try to compute the speed for the last point when not provided.
  const i1 = points.length - 1;

  if (track.extra[i1]?.speed == null && points.length >= 2) {
    const i2 = points.length - 2;
    const seconds = track.timeSec[i1] - track.timeSec[i2];
    if (seconds > 0 && seconds < 2 * 60) {
      const distance = getDistance(
        { lat: track.lat[i1], lon: track.lon[i1] },
        { lat: track.lat[i2], lon: track.lon[i2] },
      );
      const speed = (3.6 * distance) / seconds;
      track.extra[i1] = { ...track.extra[i1], speed };
    }
  }

  return track;
}

// The error and requests fields has
// - 3 upper digits for the errors,
// - 3 lower digits for the requests.
//
// 005230 means that there has been 5 errors and 230 requests.
//
// When any of the field overflow they are both divided by 2 to keep some history.
export function incrementRequests(errorAndRequests: number | undefined, value: { isError: boolean }): number {
  errorAndRequests ??= 0;
  let errors = Math.floor(errorAndRequests / 1000);
  if (value.isError === true) {
    errors++;
  }
  let requests = (errorAndRequests % 1000) + 1;
  if (requests >= 1000 || errors >= 1000) {
    errors >>= 1;
    requests >>= 1;
  }

  return errors * 1000 + requests;
}

export interface TrackerForUpdate {
  [Datastore.KEY]: Key;
  account: string;
  updated: number;
}

// Returns the list of trackers to update.
// Only consider the trackers updated before `updatedBeforeMicros`.
//
// Only the account and updated timestamp are returned;
export async function getTrackersToUpdate(
  deviceType: TrackerIds,
  updatedBeforeMicros: number,
  limit?: number,
): Promise<TrackerForUpdate[]> {
  const trackerProp = trackerPropNames[deviceType];
  const accountPath = `${trackerProp}.account`;
  const updatedPath = `${trackerProp}.updated`;
  const enabledPath = `${trackerProp}.enabled`;

  try {
    let query = datastore
      .createQuery(LIVE_TRACK_TABLE)
      .select([accountPath, updatedPath])
      .filter('enabled', true)
      .filter(enabledPath, true)
      .filter(updatedPath, '<', updatedBeforeMicros)
      .order(updatedPath, { descending: false });

    if (limit != null) {
      query = query.limit(limit);
    }

    const response = await datastore.runQuery(query);

    return response[0].map((entity) => ({
      [Datastore.KEY]: entity[Datastore.KEY],
      account: entity[accountPath],
      updated: entity[updatedPath],
    }));
  } catch (e) {
    console.error(`Error querying ${trackerPropNames[deviceType]} trackers: "${e}"`);
    return [];
  }
}

// Updates for a single live track.
export interface TrackUpdate {
  // Track delta since last update.
  track?: protos.LiveTrack;
  // There must be an error message is the update failed.
  error?: string;
  // Timestamp of the update.
  updated: number;
}

// Updates for a tracker type.
export interface TrackerUpdate {
  trackerId: TrackerIds;
  // Map of id to track update.
  tracks: Map<number, TrackUpdate>;
  // Map of datastore id to account.
  // Used to update an account when resolved by the tracker code.
  // `false` disable the account.
  accounts?: Map<number, string | false>;
  errors: string[];
  durationSec: number;
}

export interface TrackerLogEntry {
  errors: string[];
  accountErrors: Map<number, string>;
  numDevices: number;
  timestamp: number;
  durationSec: number;
}

export type TrackerLogs = Map<TrackerIds, TrackerLogEntry>;

// Update all the trackers:
// - Fetch the deltas,
// - Fetch the ground elevation,
// - Merge with existing tracks,
// - Save to datastore.
export async function updateTrackers(): Promise<TrackerLogs> {
  const start = Date.now();
  const refreshes = await Promise.allSettled([inreach.refresh(), spot.refresh(), skylines.refresh(), flyme.refresh()]);

  const updates: TrackerUpdate[] = [];
  // Collect all the ids that have been updated.
  const idSet = new Set<number>();

  // Accumulate the updates from all the devices.
  refreshes.forEach((trackerPromise, i: number) => {
    if (trackerPromise.status == 'fulfilled') {
      const update = trackerPromise.value;
      updates.push(update);
      [...update.tracks.keys()].forEach((id) => idSet.add(id));
      const tracker = trackerDisplayNames[update.trackerId];
      console.log(`[${tracker}] Update ${update.tracks.size} devices in ${update.durationSec}s`);
      if (update.errors.length > 0) {
        console.error(`[${tracker}] Update error: ${update.errors.join(`, `)}`);
      }
    } else {
      console.error(`Tracker update #${i} error: ${trackerPromise.reason}`);
    }
  });

  console.log(`Updates fetched in ${Math.round((Date.now() - start) / 1000)}s`);

  const ids = [...idSet];
  const startSave = Date.now();
  const savePromises: Promise<boolean>[] = [];

  while (ids.length > 0) {
    const batchIds = ids.splice(0, 20);
    const batchKeys = batchIds.map((id) => datastore.key([LIVE_TRACK_TABLE, id]));
    savePromises.push(saveTrackersWithRetries(batchKeys, updates));
  }

  const logs = new Map<TrackerIds, TrackerLogEntry>();

  updates.forEach((update) => {
    const log = {
      errors: update.errors,
      accountErrors: new Map<number, string>(),
      numDevices: update.tracks.size,
      timestamp: start,
      durationSec: update.durationSec,
    };

    for (const [id, track] of update.tracks.entries()) {
      if (track.error) {
        log.accountErrors.set(id, track.error);
      }
    }

    logs.set(update.trackerId, log);
  });

  const saveResults = await Promise.allSettled(savePromises);
  let saveErrors = 0;
  saveResults.forEach((result) => {
    if (result.status == 'fulfilled' && result.value == false) {
      saveErrors++;
    }
    if (result.status == 'rejected') {
      // This should only happen if the rollback throws.
      console.error(`Batch transactions failure: ${result.reason}`);
      saveErrors++;
    }
  });

  if (saveErrors > 0) {
    console.error(`${saveErrors} batch save errors`);
  }

  console.log(`Trackers updated in ${Math.round((Date.now() - startSave) / 1000)}s`);
  return logs;
}

// Updates the tracker in a transaction.
//
// The transaction might fail when a user saves concurrently update their settings.
// The transaction is retried in such a case.
//
// Returns whether the transaction went through ok.
async function saveTrackersWithRetries(keys: Key[], trackerUpdates: TrackerUpdate[], retries = 3): Promise<boolean> {
  while (retries-- > 0) {
    const transaction = datastore.transaction();
    try {
      await transaction.run();

      const [entities]: LiveTrackEntity[][] = await datastore.get(keys);

      // Apply the updates.
      entities.forEach((entity: LiveTrackEntity) => {
        const id = idFromEntity(entity);
        let track = entity.track ? protos.LiveTrack.fromBinary(entity.track) : protos.LiveTrack.create();

        trackerUpdates.forEach((trackerUpdate) => {
          const trackerProp = trackerPropNames[trackerUpdate.trackerId];
          const tracker: TrackerEntity = (entity as any)[trackerProp];

          // Update the tracker with the new points.
          const update = trackerUpdate.tracks.get(id);
          if (update) {
            const isError = update.error != null;
            tracker.errors_requests = incrementRequests(tracker.errors_requests, { isError });
            if (!isError) {
              // Update the track and the timestamp only when no errors.
              tracker.updated = update.updated;
              if (update.track) {
                track = mergeLiveTracks(track, update.track);
              }
            }
          }

          // We might need to update the account.
          const account = trackerUpdate.accounts?.get(id);
          if (account != null) {
            if (account === false) {
              tracker.enabled = false;
            } else {
              tracker.account = account;
            }
          }
        });

        track = removeBeforeFromLiveTrack(track, Date.now() / 1000 - LIVE_RETENTION_SEC);
        entity.track = Buffer.from(protos.LiveTrack.toBinary(track));
        if (track.timeSec.length > 0) {
          entity.last_fix_sec = track.timeSec[track.timeSec.length - 1];
        }

        transaction.save({
          key: entity[Datastore.KEY],
          data: entity,
          excludeFromIndexes: ['track'],
        });
      });

      await transaction.commit();

      return true;
    } catch (e) {
      console.error(`Transaction error: ${e}, retries = ${retries}`);
      await transaction.rollback();
    }
  }

  return false;
}
