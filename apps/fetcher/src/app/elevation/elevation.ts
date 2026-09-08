import { Comparison, findFirstIndex, isGroundAltitudeValid, NO_GROUND_ALTITUDE, type protos } from '@flyxc/common';
import { type ElevationCacheStats, ElevationService } from '@flyxc/common-node';

export interface ElevationUpdates {
  errors: string[];
  // Number of points fetched.
  numFetched: number;
  // Number of elevation retrieved.
  numRetrieved: number;
  // Duration in seconds.
  durationSec: number;
  // LRU cache statistics.
  cache?: ElevationCacheStats;
}

// Maximum number of points to query per batch.
export const ELEVATION_BATCH_SIZE = 50;

// Timeout in milliseconds for fetching elevations across all tracks.
export const ELEVATION_FETCH_TIMEOUT_MS = 10_000;

const defaultElevationService = new ElevationService({ cacheSizeMb: 50, zoom: 10 });

export interface TrackElevationPatch {
  track: protos.LiveTrack;
  fromSec?: number;
}

/**
 * Populates ground altitudes for newly added points in tracks.
 *
 * Missing points across all tracks are batched in chunks of up to ELEVATION_BATCH_SIZE.
 * After each batch, execution time is checked against ELEVATION_FETCH_TIMEOUT_MS to stop early.
 *
 * @param tracks - Tracks or patch objects with optional `fromSec` timestamp.
 * @param elevationService - Elevation service instance (defaults to shared module instance).
 * @returns Summary of fetched points, retrieved elevations, duration, and errors.
 */
export async function patchTracksElevation(
  tracks: Iterable<TrackElevationPatch>,
  elevationService = defaultElevationService,
): Promise<ElevationUpdates> {
  const startMs = Date.now();
  const updates: ElevationUpdates = {
    errors: [],
    numFetched: 0,
    numRetrieved: 0,
    durationSec: 0,
    cache: elevationService.getCacheStats(),
  };

  type Target = {
    track: protos.LiveTrack;
    idx: number;
  };

  const targets: Target[] = [];
  const allLats: number[] = [];
  const allLons: number[] = [];

  for (const { track, fromSec } of tracks) {
    if (!track || track.lat.length === 0) {
      continue;
    }

    if (track.gndAlt?.length !== track.lat.length) {
      track.gndAlt = Array(track.lat.length).fill(NO_GROUND_ALTITUDE);
    }

    const startIdx =
      fromSec != null && track.timeSec?.length > 0
        ? findFirstIndex(track.timeSec, fromSec, { comparison: Comparison.GREATER_EQUAL })
        : 0;

    for (let i = startIdx; i < track.lat.length; i++) {
      if (!isGroundAltitudeValid(track.gndAlt[i])) {
        targets.push({ track, idx: i });
        allLats.push(track.lat[i]);
        allLons.push(track.lon[i]);
      }
    }
  }

  if (targets.length === 0) {
    updates.durationSec = Math.round((Date.now() - startMs) / 1000);
    return updates;
  }

  let hasErrors = false;

  for (let offset = 0; offset < targets.length; offset += ELEVATION_BATCH_SIZE) {
    if (Date.now() - startMs >= ELEVATION_FETCH_TIMEOUT_MS) {
      hasErrors = true;
      updates.errors.push('Timeout fetching elevation for tracks');
      break;
    }

    const batchTargets = targets.slice(offset, offset + ELEVATION_BATCH_SIZE);
    const batchLats = allLats.slice(offset, offset + ELEVATION_BATCH_SIZE);
    const batchLons = allLons.slice(offset, offset + ELEVATION_BATCH_SIZE);

    updates.numFetched += batchTargets.length;

    try {
      const result = await elevationService.fetchCoordinatesAltitude(batchLats, batchLons);
      if (result.hasErrors) {
        hasErrors = true;
      }
      for (let i = 0; i < batchTargets.length; i++) {
        const alt = result.altitudes[i];
        if (isGroundAltitudeValid(alt)) {
          const { track, idx } = batchTargets[i];
          track.gndAlt[idx] = Math.round(alt);
          updates.numRetrieved++;
        }
      }
    } catch (e) {
      hasErrors = true;
      updates.errors.push(e instanceof Error ? e.message : String(e));
    }

    if (offset + ELEVATION_BATCH_SIZE < targets.length && Date.now() - startMs >= ELEVATION_FETCH_TIMEOUT_MS) {
      hasErrors = true;
      updates.errors.push('Timeout fetching elevation for tracks');
      break;
    }
  }

  if (hasErrors && updates.errors.length === 0) {
    updates.errors.push('Failed to retrieve ground elevation for some coordinates');
  }

  updates.durationSec = Math.round((Date.now() - startMs) / 1000);
  updates.cache = elevationService.getCacheStats();

  return updates;
}
