import * as protos from '../protos';
import { approximateDistanceSquared } from './distance';
import { isValidFix } from './live-track';
import { Comparison, findFirstIndex } from './math';

/**
 * Maximum physical speed ceiling in km/h for live tracking.
 * Covers paragliders, hang gliders, sailplanes, and light aircraft while filtering spurious GPS coordinate jumps.
 */
export const MAX_LIVE_SPEED_KMH = 300;

/**
 * Maximum time gap between consecutive fixes in seconds before resetting confidence.
 * A gap greater than this starts a new flight session and allows relocation to a new takeoff site.
 */
export const LIVE_GAP_RESET_SEC = 3600;

/**
 * Ratio of valid fixes to outlier fixes required to establish location confidence.
 * Ensures consensus is firmly established before committing and pruning outliers.
 */
export const CONFIDENCE_RATIO = 5;

/**
 * Minimum number of mutually consistent valid fixes required to establish confidence.
 */
export const MIN_CONFIDENT_FIXES = 5;

/**
 * Configuration and state options for live track outlier filtering.
 */
export interface LiveTrackFilterOptions {
  /** Confidence level in the track's true geographic location. */
  locationConfidence?: protos.TrackLocationConfidence;
  /** Latest timestamp (sec) of an outlier fix pruned in the active flight segment across cycles. */
  lastOutlierFixSec?: number;
  /** Timestamp (sec) of the start of the active segment when confidence was established. */
  lastSessionStartSec?: number;
  /**
   * Optional timestamp in seconds to filter from.
   * In Phase 2, fixes prior to this timestamp are known to be valid and are skipped,
   * with the fix immediately preceding `filterFromSec` serving as the anchor.
   */
  filterFromSec?: number;
  /** Maximum physical speed in km/h (defaults to MAX_LIVE_SPEED_KMH). */
  maxSpeedKmh?: number;
  /** Maximum gap in seconds between fixes before starting a new session (defaults to LIVE_GAP_RESET_SEC). */
  maxGapSec?: number;
  /** Ratio of valid fixes to outliers required for confidence (defaults to CONFIDENCE_RATIO). */
  confidenceRatio?: number;
  /** Minimum number of valid fixes required for confidence (defaults to MIN_CONFIDENT_FIXES). */
  minConfidentFixes?: number;
}

/**
 * Result returned by filterLiveTrackOutliers.
 */
export interface FilterLiveTrackResult {
  /** The filtered live track. */
  track: protos.LiveTrack;
  /** Updated location confidence state. */
  locationConfidence: protos.TrackLocationConfidence;
  /** Latest timestamp (sec) of an outlier pruned in this segment (if any), to be sent to clients. */
  lastOutlierFixSec?: number;
  /** Timestamp (sec) of the start of the active segment when confidence was established. */
  lastSessionStartSec?: number;
}

/**
 * Checks whether fix at `index` is a valid position fix.
 *
 * @param track - The live track.
 * @param index - Fix index.
 * @returns True if the fix has valid GPS flags or if flags are not provided.
 */
function isTrackFixValid(track: protos.LiveTrack, index: number): boolean {
  if (track.flags && track.flags.length > index) {
    return isValidFix(track.flags[index]);
  }
  return true;
}

/**
 * Checks whether fix at `targetIndex` is reachable from fix at `startIndex` within the maximum speed limit.
 *
 * Fixes marked invalid in `track.flags` are not reachable.
 * Uses `approximateDistanceSquared` to avoid object allocations and square-root calculations.
 *
 * @param track - The live track containing coordinates and timestamps.
 * @param startIndex - The starting fix index.
 * @param targetIndex - The target fix index (must be chronologically after `startIndex`).
 * @param maxSpeedKmh - Maximum allowed speed in km/h.
 * @returns True if the target fix is physically reachable from the start fix at or below maxSpeedKmh.
 */
function isReachable(track: protos.LiveTrack, startIndex: number, targetIndex: number, maxSpeedKmh: number): boolean {
  if (!isTrackFixValid(track, startIndex) || !isTrackFixValid(track, targetIndex)) {
    return false;
  }

  const dt = track.timeSec[targetIndex] - track.timeSec[startIndex];
  if (dt <= 0) {
    return false;
  }

  // Maximum distance reachable in meters at maxSpeedKmh over dt seconds.
  const maxDistMeters = (maxSpeedKmh / 3.6) * dt;

  return (
    approximateDistanceSquared(
      track.lat[startIndex],
      track.lon[startIndex],
      track.lat[targetIndex],
      track.lon[targetIndex],
    ) <=
    maxDistMeters * maxDistMeters
  );
}

/**
 * Finds the index of the start of the active session (after any gap > maxGapSec).
 *
 * @param timeSec - Array of fix timestamps in seconds.
 * @param maxGapSec - Maximum gap threshold in seconds.
 * @returns The starting index of the active session (0 if no gap exists).
 */
function getActiveSessionStartIndex(timeSec: number[], maxGapSec: number): number {
  for (let i = timeSec.length - 1; i > 0; i--) {
    if (timeSec[i] - timeSec[i - 1] > maxGapSec) {
      return i;
    }
  }
  return 0;
}

/**
 * Prunes specific indices from a live track and reindexes extra metadata.
 *
 * @param track - The live track to prune.
 * @param droppedIndices - Set of fix indices to remove.
 * @returns A new LiveTrack with the specified indices removed and extra metadata remapped.
 */
function pruneTrackIndices(track: protos.LiveTrack, droppedIndices: Set<number>): protos.LiveTrack {
  const len = track.timeSec.length;
  if (droppedIndices.size === 0) {
    return track;
  }

  const newLen = len - droppedIndices.size;
  const timeSec: number[] = new Array(newLen);
  const lat: number[] = new Array(newLen);
  const lon: number[] = new Array(newLen);
  const alt: number[] = new Array(newLen);
  const flags: number[] = new Array(newLen);
  const gndAlt: number[] | undefined = track.gndAlt?.length === len ? new Array(newLen) : undefined;

  let extra: { [key: number]: protos.LiveExtra } | undefined;
  if (track.extra) {
    extra = {};
  }

  let newIdx = 0;
  for (let i = 0; i < len; i++) {
    if (droppedIndices.has(i)) {
      continue;
    }
    timeSec[newIdx] = track.timeSec[i];
    lat[newIdx] = track.lat[i];
    lon[newIdx] = track.lon[i];
    alt[newIdx] = track.alt[i];
    flags[newIdx] = track.flags[i];
    if (gndAlt) {
      gndAlt[newIdx] = track.gndAlt![i];
    }
    if (track.extra?.[i]) {
      extra![newIdx] = { ...track.extra[i] };
    }
    newIdx++;
  }

  return {
    ...track,
    timeSec,
    lat,
    lon,
    alt,
    flags,
    gndAlt: gndAlt ?? track.gndAlt,
    extra: extra ?? track.extra,
  };
}

/**
 * Finds the longest mutually reachable chain of fixes in the active session using dynamic programming.
 *
 * @param track - The live track.
 * @param sessionStart - Start index of the active session.
 * @param sessionLength - Number of fixes in the active session.
 * @param maxSpeedKmh - Maximum kinematic speed allowed between fixes.
 * @param minRequiredFixes - Minimum valid fixes required to establish consensus.
 * @returns Set of track indices that form the longest consistent chain, or undefined if the threshold is unreachable.
 */
function findConsensusChain(
  track: protos.LiveTrack,
  sessionStart: number,
  sessionLength: number,
  maxSpeedKmh: number,
  minRequiredFixes: number,
): Set<number> | undefined {
  const maxOutliersAllowed = sessionLength - minRequiredFixes;
  if (maxOutliersAllowed < 0) {
    return undefined;
  }

  const maxSpeedMs = maxSpeedKmh / 3.6;
  const { timeSec, lat, lon } = track;

  // longestChainLengths[k] stores the length of the longest valid chain ending at session index k (sessionStart + k).
  // Valid fixes start with 1; invalid fixes start with 0.
  const longestChainLengths = new Int32Array(sessionLength);
  for (let k = 0; k < sessionLength; k++) {
    longestChainLengths[k] = isTrackFixValid(track, sessionStart + k) ? 1 : 0;
  }
  // parent[k] stores the predecessor index in the chain (-1 if k starts a chain), used for backtracking.
  const parent = new Int32Array(sessionLength).fill(-1);

  let bestLen = 0;
  let bestEnd = -1;
  for (let k = 0; k < sessionLength; k++) {
    if (longestChainLengths[k] > bestLen) {
      bestLen = longestChainLengths[k];
      bestEnd = k;
    }
  }

  for (let k = 1; k < sessionLength; k++) {
    // Early abort: if best chain found so far plus all remaining fixes cannot reach threshold
    if (bestLen + (sessionLength - k) < minRequiredFixes) {
      break;
    }

    const currIdx = sessionStart + k;
    if (!isTrackFixValid(track, currIdx)) {
      continue;
    }

    const currTime = timeSec[currIdx];
    const currLat = lat[currIdx];
    const currLon = lon[currIdx];

    // Any chain containing edge (j, k) drops at least (k - 1 - j) intermediate fixes.
    // Thus j needs only scan back within the session's overall outlier budget.
    const minJ = Math.max(0, k - 1 - maxOutliersAllowed);
    for (let j = k - 1; j >= minJ; j--) {
      if (longestChainLengths[j] === 0) {
        continue;
      }
      if (j + 1 < longestChainLengths[k]) {
        // A chain ending at index j has length at most j + 1, so extending it with fix k could yield
        // at most j + 2. If j + 1 < longestChainLengths[k], no earlier index j' <= j can beat our current best.
        break;
      }
      if (longestChainLengths[j] + 1 <= longestChainLengths[k]) {
        // Even if k is reachable from j, extending j's chain would not improve upon
        // our current best length for k. Skip the distance check.
        continue;
      }
      const prevIdx = sessionStart + j;
      const dt = currTime - timeSec[prevIdx];
      if (dt <= 0) {
        continue;
      }

      const maxDistMeters = maxSpeedMs * dt;

      if (approximateDistanceSquared(lat[prevIdx], lon[prevIdx], currLat, currLon) <= maxDistMeters * maxDistMeters) {
        longestChainLengths[k] = longestChainLengths[j] + 1;
        parent[k] = j;
      }
    }
    if (longestChainLengths[k] > bestLen) {
      bestLen = longestChainLengths[k];
      bestEnd = k;
    }
  }

  if (bestLen < minRequiredFixes || bestEnd === -1) {
    return undefined;
  }

  const chainSet = new Set<number>();
  for (let curr = bestEnd; curr !== -1; curr = parent[curr]) {
    chainSet.add(sessionStart + curr);
  }
  return chainSet;
}

/**
 * Phase 1: Establishes initial consensus among tentative fixes in an unconfirmed session.
 *
 * Checks if the session has enough fixes to establish confidence, evaluates the consensus chain,
 * and if confident, prunes outliers and promotes the track to KNOWN location confidence.
 *
 * @param track - The live track to filter.
 * @param sessionStart - Start index of the active session.
 * @param sessionStartSec - Timestamp in seconds of the start of the active session.
 * @param lastOutlierFixSec - Latest timestamp of an outlier pruned in previous filtering cycles.
 * @param lastSessionStartSec - Start timestamp of the session when confidence was established.
 * @param maxSpeedKmh - Maximum kinematic speed allowed between fixes in km/h.
 * @param maxGapSec - Maximum gap threshold in seconds before resetting session.
 * @param confidenceRatio - Ratio of valid to outlier fixes required to confirm consensus.
 * @param minConfidentFixes - Minimum valid fixes required to confirm consensus.
 * @returns The filtered track result including updated confidence and outlier timestamps.
 */
function filterUnconfirmedSession(
  track: protos.LiveTrack,
  sessionStart: number,
  sessionStartSec: number,
  lastOutlierFixSec: number | undefined,
  lastSessionStartSec: number | undefined,
  maxSpeedKmh: number,
  maxGapSec: number,
  confidenceRatio: number,
  minConfidentFixes: number,
): FilterLiveTrackResult {
  const len = track.timeSec.length;
  const sessionLength = len - sessionStart;

  if (sessionLength < minConfidentFixes) {
    return {
      track,
      locationConfidence: protos.TrackLocationConfidence.UNCONFIRMED,
      lastOutlierFixSec,
      lastSessionStartSec,
    };
  }

  // Fast-path: check if all consecutive fixes in the active session form a valid chain.
  let isCleanChain = isTrackFixValid(track, sessionStart);
  if (isCleanChain) {
    for (let i = sessionStart + 1; i < len; i++) {
      if (!isTrackFixValid(track, i) || !isReachable(track, i - 1, i, maxSpeedKmh)) {
        isCleanChain = false;
        break;
      }
    }
  }

  if (isCleanChain) {
    track.lastOutlierFixSec = lastOutlierFixSec;
    return {
      track,
      locationConfidence: protos.TrackLocationConfidence.KNOWN,
      lastOutlierFixSec,
      lastSessionStartSec: sessionStartSec,
    };
  }

  const minRequiredFixes = Math.max(
    minConfidentFixes,
    Math.ceil((confidenceRatio * sessionLength) / (1 + confidenceRatio)),
  );

  const chainSet = findConsensusChain(track, sessionStart, sessionLength, maxSpeedKmh, minRequiredFixes);

  if (!chainSet) {
    return {
      track,
      locationConfidence: protos.TrackLocationConfidence.UNCONFIRMED,
      lastOutlierFixSec,
      lastSessionStartSec,
    };
  }

  // Confidence established: drop outliers outside the consensus chain
  const droppedIndices = new Set<number>();
  for (let k = 0; k < sessionLength; k++) {
    const idx = sessionStart + k;
    if (!chainSet.has(idx)) {
      droppedIndices.add(idx);
    }
  }

  let updatedLastOutlierFixSec = lastOutlierFixSec;
  if (droppedIndices.size > 0) {
    let maxDroppedSec = -Infinity;
    for (const idx of droppedIndices) {
      if (track.timeSec[idx] > maxDroppedSec) {
        maxDroppedSec = track.timeSec[idx];
      }
    }
    updatedLastOutlierFixSec =
      lastOutlierFixSec == null ? maxDroppedSec : Math.max(lastOutlierFixSec + 1, maxDroppedSec);
  }

  const prunedTrack = droppedIndices.size > 0 ? pruneTrackIndices(track, droppedIndices) : track;
  prunedTrack.lastOutlierFixSec = updatedLastOutlierFixSec;
  const prunedSessionStart = getActiveSessionStartIndex(prunedTrack.timeSec, maxGapSec);
  const confidentSessionStartSec = prunedTrack.timeSec[prunedSessionStart];

  return {
    track: prunedTrack,
    locationConfidence: protos.TrackLocationConfidence.KNOWN,
    lastOutlierFixSec: updatedLastOutlierFixSec,
    lastSessionStartSec: confidentSessionStartSec,
  };
}

/**
 * Phase 2: Validates fixes in O(1) against the tail anchor for an already confident session.
 *
 * Checks fixes sequentially against the known valid tail anchor, dropping speed spikes.
 *
 * @param track - The live track to filter.
 * @param sessionStart - Start index of the active session.
 * @param sessionStartSec - Timestamp in seconds of the start of the active session.
 * @param lastOutlierFixSec - Latest timestamp of an outlier pruned in previous filtering cycles.
 * @param lastSessionStartSec - Start timestamp of the session when confidence was established.
 * @param maxSpeedKmh - Maximum kinematic speed allowed between fixes in km/h.
 * @param filterFromSec - Optional timestamp in seconds to filter from (skips already validated fixes).
 * @returns The filtered track result including updated confidence and outlier timestamps.
 */
function filterConfidentSession(
  track: protos.LiveTrack,
  sessionStart: number,
  sessionStartSec: number,
  lastOutlierFixSec: number | undefined,
  lastSessionStartSec: number | undefined,
  maxSpeedKmh: number,
  filterFromSec: number | undefined,
): FilterLiveTrackResult {
  const len = track.timeSec.length;
  const droppedIndices = new Set<number>();
  let startIdx = sessionStart + 1;
  let anchorIdx = sessionStart;

  if (filterFromSec != null && filterFromSec > sessionStartSec) {
    const fromIdx = findFirstIndex(track.timeSec, filterFromSec, Comparison.GREATER_EQUAL);
    if (fromIdx > sessionStart) {
      startIdx = fromIdx;
      anchorIdx = fromIdx - 1;
    }
  }

  // Ensure anchorIdx points to a valid fix
  while (anchorIdx >= sessionStart && !isTrackFixValid(track, anchorIdx)) {
    anchorIdx--;
  }
  if (anchorIdx < sessionStart) {
    for (let i = sessionStart; i < len; i++) {
      if (isTrackFixValid(track, i)) {
        anchorIdx = i;
        startIdx = Math.max(startIdx, i + 1);
        break;
      }
    }
  }

  for (let i = startIdx; i < len; i++) {
    if (isTrackFixValid(track, i) && anchorIdx >= 0 && isReachable(track, anchorIdx, i, maxSpeedKmh)) {
      anchorIdx = i;
    } else {
      droppedIndices.add(i);
    }
  }

  let updatedLastOutlierFixSec = lastOutlierFixSec;
  if (droppedIndices.size > 0) {
    let maxDroppedSec = -Infinity;
    for (const idx of droppedIndices) {
      if (track.timeSec[idx] > maxDroppedSec) {
        maxDroppedSec = track.timeSec[idx];
      }
    }
    updatedLastOutlierFixSec =
      lastOutlierFixSec == null ? maxDroppedSec : Math.max(lastOutlierFixSec + 1, maxDroppedSec);
  }

  const pruned = droppedIndices.size > 0 ? pruneTrackIndices(track, droppedIndices) : track;
  pruned.lastOutlierFixSec = updatedLastOutlierFixSec;
  return {
    track: pruned,
    locationConfidence: protos.TrackLocationConfidence.KNOWN,
    lastOutlierFixSec: updatedLastOutlierFixSec,
    lastSessionStartSec,
  };
}

/**
 * Filters GPS speed outliers in a live track using a two-phase confidence model.
 *
 * - Phase 1 (Unconfident): Keeps points tentative until consensus is confident:
 *   `validFixes >= minConfidentFixes` AND `validFixes >= confidenceRatio * outlierFixes`.
 *   Once confident, outliers in the session are pruned, and locationConfidence transitions to KNOWN.
 *
 * - Phase 2 (Confident): Fixes are validated in O(1) against the tail anchor.
 *   Points exceeding maxSpeedKmh are dropped immediately as spikes.
 *
 * - Time gap > maxGapSec resets confidence to UNCONFIRMED for the new session.
 *
 * @param track - The live track to filter.
 * @param options - Configuration and previous filter state.
 * @returns The filtered track, updated confidence state, and latest outlier timestamp.
 */
export function filterLiveTrackOutliers(
  track: protos.LiveTrack,
  options: LiveTrackFilterOptions = {},
): FilterLiveTrackResult {
  const {
    maxSpeedKmh = MAX_LIVE_SPEED_KMH,
    maxGapSec = LIVE_GAP_RESET_SEC,
    confidenceRatio = CONFIDENCE_RATIO,
    minConfidentFixes = MIN_CONFIDENT_FIXES,
    lastSessionStartSec,
    filterFromSec,
  } = options;
  const lastOutlierFixSec = options.lastOutlierFixSec ?? track.lastOutlierFixSec;
  let locationConfidence = options.locationConfidence ?? protos.TrackLocationConfidence.UNKNOWN;

  const len = track.timeSec.length;
  if (len === 0) {
    track.lastOutlierFixSec = lastOutlierFixSec;
    return {
      track,
      locationConfidence: protos.TrackLocationConfidence.UNKNOWN,
      lastOutlierFixSec,
      lastSessionStartSec,
    };
  }

  const sessionStart = getActiveSessionStartIndex(track.timeSec, maxGapSec);
  const sessionStartSec = track.timeSec[sessionStart];

  // If a gap > maxGapSec created a new session, or if retention shifted the session start,
  // ensure this active session has established consensus.
  // We check if the active session's start timestamp matches the session start when confidence was established.
  if ((sessionStart > 0 || lastSessionStartSec != null) && lastSessionStartSec !== sessionStartSec) {
    locationConfidence = protos.TrackLocationConfidence.UNCONFIRMED;
  }

  // Phase 1: Unconfirmed mode (establishing consensus)
  if (locationConfidence !== protos.TrackLocationConfidence.KNOWN) {
    return filterUnconfirmedSession(
      track,
      sessionStart,
      sessionStartSec,
      lastOutlierFixSec,
      lastSessionStartSec,
      maxSpeedKmh,
      maxGapSec,
      confidenceRatio,
      minConfidentFixes,
    );
  }

  // Phase 2: Location is already confident in the current session
  return filterConfidentSession(
    track,
    sessionStart,
    sessionStartSec,
    lastOutlierFixSec,
    lastSessionStartSec,
    maxSpeedKmh,
    filterFromSec,
  );
}
