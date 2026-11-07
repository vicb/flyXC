import type * as protos from '../protos';
import { approximateDistanceSquared } from './distance';
import { isProtectedFix, isValidFix, NO_GROUND_ALTITUDE } from './live-track';
import { Comparison, findFirstIndex } from './math';

/**
 * Maximum physical speed ceiling in km/h for live tracking.
 * Covers paragliders, hang gliders, sailplanes, and light aircraft while filtering spurious GPS coordinate jumps.
 */
export const MAX_LIVE_SPEED_KMH = 300;

/**
 * Minimum distance threshold in meters before a fix can be considered a speed outlier.
 * Accommodates same-second fixes (`dt = 0`) and position/clock-skew offsets when a track is
 * merged from multiple trackers reporting at nearly the same timestamp.
 */
export const MIN_OUTLIER_DIST_M = 500;

/**
 * Maximum time gap between consecutive fixes in seconds before starting a new flight session.
 * A gap greater than 1 hour allows pilots to relocate to a new takeoff site between flights.
 */
export const LIVE_GAP_RESET_SEC = 3600;

/**
 * Minimum number of mutually consistent valid fixes required on the server to establish
 * location confidence before pruning outliers in the active session.
 */
export const MIN_CONFIDENT_FIXES = 5;

/**
 * Minimum ratio between the longest valid chain and any other disjoint chain in the active session
 * required on the server to establish initial location confidence.
 */
export const CONFIDENCE_RATIO = 3;

/** Minimum consistent valid fixes to prune outliers on client (lower because delta is simplified). */
export const CLIENT_MIN_CONFIDENT_FIXES = 2;

/** Minimum chain dominance ratio on client (1:1 tie-break is sufficient after server validation). */
export const CLIENT_CONFIDENCE_RATIO = 1;

/**
 * Configuration options for live track outlier filtering.
 */
export interface LiveTrackFilterOptions {
  /**
   * Optional timestamp (sec) of the earliest fix added in the current update cycle.
   * When the beginning of the active session already has `MIN_CONFIDENT_FIXES` clean fixes,
   * only fixes from `filterFromSec` onwards are evaluated against the preceding anchor.
   */
  filterFromSec?: number;
  /** Maximum physical speed in km/h (defaults to MAX_LIVE_SPEED_KMH). */
  maxSpeedKmh?: number;
  /** Maximum gap in seconds between fixes before starting a new session (defaults to LIVE_GAP_RESET_SEC). */
  maxGapSec?: number;
  /** Minimum number of mutually consistent valid fixes required to prune outliers (defaults to MIN_CONFIDENT_FIXES). */
  minConfidentFixes?: number;
  /** Minimum ratio of the longest chain to any other disjoint chain (defaults to CONFIDENCE_RATIO). */
  confidenceRatio?: number;
}

/**
 * Checks whether the fix at `index` has a valid GPS flag (or if flags are omitted).
 */
function isTrackFixValid(track: protos.LiveTrack, index: number): boolean {
  if (track.flags && track.flags.length > index) {
    return isValidFix(track.flags[index]);
  }
  return true;
}

/**
 * Checks whether the fix at `targetIndex` is kinematically reachable from `startIndex`
 * within `maxSpeedKmh` (or `MIN_OUTLIER_DIST_M`), and that both fixes are marked valid.
 *
 * Uses `approximateDistanceSquared` to avoid heap allocations and `Math.sqrt`.
 */
function isReachable(track: protos.LiveTrack, startIndex: number, targetIndex: number, maxSpeedKmh: number): boolean {
  if (!isTrackFixValid(track, startIndex) || !isTrackFixValid(track, targetIndex)) {
    return false;
  }

  const dt = track.timeSec[targetIndex] - track.timeSec[startIndex];
  if (dt < 0) {
    return false;
  }

  const maxDistMeters = Math.max(MIN_OUTLIER_DIST_M, (maxSpeedKmh / 3.6) * dt);

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
 * Finds the start index of the active flight session (the first fix after any gap > `maxGapSec`).
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
 * Prunes `droppedIndices` from `track` in place, reindexing `extra` metadata,
 * and monotonically updating `lastOutlierFixSec`.
 *
 * Modifies track arrays in-place to prevent allocating new arrays and garbage collection pressure.
 */
function pruneAndRecordOutliers(track: protos.LiveTrack, droppedIndices: Set<number>): protos.LiveTrack {
  for (const index of droppedIndices) {
    if (isProtectedFix(track, index)) {
      droppedIndices.delete(index);
    }
  }

  if (droppedIndices.size === 0) {
    return track;
  }

  const len = track.timeSec.length;
  let maxDroppedSec = -Infinity;
  let dstIdx = 0;

  for (let srcIdx = 0; srcIdx < len; srcIdx++) {
    if (droppedIndices.has(srcIdx)) {
      if (track.timeSec[srcIdx] > maxDroppedSec) {
        maxDroppedSec = track.timeSec[srcIdx];
      }
      delete track.extra?.[srcIdx];
      continue;
    }

    if (dstIdx !== srcIdx) {
      track.timeSec[dstIdx] = track.timeSec[srcIdx];
      track.lat[dstIdx] = track.lat[srcIdx];
      track.lon[dstIdx] = track.lon[srcIdx];
      track.alt[dstIdx] = track.alt[srcIdx];
      track.flags[dstIdx] = track.flags[srcIdx];
      if (track.gndAlt) {
        track.gndAlt[dstIdx] = srcIdx < track.gndAlt.length ? track.gndAlt[srcIdx] : NO_GROUND_ALTITUDE;
      }
      if (track.extra) {
        if (srcIdx in track.extra) {
          track.extra[dstIdx] = track.extra[srcIdx];
          delete track.extra[srcIdx];
        } else {
          delete track.extra[dstIdx];
        }
      }
    }
    dstIdx++;
  }

  track.timeSec.splice(dstIdx);
  track.lat.splice(dstIdx);
  track.lon.splice(dstIdx);
  track.alt.splice(dstIdx);
  track.flags.splice(dstIdx);
  if (track.gndAlt) {
    track.gndAlt.splice(dstIdx);
  }

  // Preserve the marker when an already-pruned outlier is re-fetched during the 5-min tracker overlap.
  track.lastOutlierFixSec = Math.max(track.lastOutlierFixSec ?? -Infinity, maxDroppedSec);

  return track;
}

/**
 * Finds the longest chain of valid, kinematically reachable fixes in the active session
 * `[sessionStart, sessionStart + sessionLength)`.
 *
 * Confidence is established only when:
 * - `bestLen >= minConfidentFixes`, AND
 * - `bestLen >= confidenceRatio * secondBestLen` (at least `confidenceRatio` times longer than any other disjoint chain).
 *
 * Returns the set of track indices in the winning chain, or `undefined` if confidence is not yet reached.
 */
function findConsensusChain(
  track: protos.LiveTrack,
  sessionStart: number,
  sessionLength: number,
  maxSpeedKmh: number,
  minConfidentFixes: number,
  confidenceRatio: number,
  preferLatestOnTie: boolean,
): Set<number> | undefined {
  // chainLen[k] stores the length of the longest valid chain ending at session offset k.
  // maxChainBefore[k] stores max(chainLen[0..k]) so the backward scan can stop as soon as
  // no earlier fix can improve upon chainLen[k] (making normal valid fixes O(1)).
  // parent[k] stores the predecessor offset in the chain (-1 if k starts a chain).
  const chainLen = new Int32Array(sessionLength);
  const maxChainBefore = new Int32Array(sessionLength);
  const parent = new Int32Array(sessionLength).fill(-1);

  let bestLen = 0;
  let bestEnd = -1;

  for (let k = 0; k < sessionLength; k++) {
    // Early abort if even extending bestLen with every remaining fix cannot reach minConfidentFixes.
    if (bestLen + (sessionLength - k) < minConfidentFixes) {
      break;
    }

    const currIdx = sessionStart + k;
    if (isTrackFixValid(track, currIdx)) {
      chainLen[k] = 1;
      for (let j = k - 1; j >= 0; j--) {
        // No fix at or before j has a chain longer than maxChainBefore[j],
        // so scanning further back cannot improve upon chainLen[k].
        if (maxChainBefore[j] + 1 <= chainLen[k]) {
          break;
        }
        if (chainLen[j] + 1 > chainLen[k] && isReachable(track, sessionStart + j, currIdx, maxSpeedKmh)) {
          chainLen[k] = chainLen[j] + 1;
          parent[k] = j;
        }
      }
    }

    maxChainBefore[k] = k > 0 ? Math.max(maxChainBefore[k - 1], chainLen[k]) : chainLen[k];

    if (preferLatestOnTie ? chainLen[k] >= bestLen && chainLen[k] > 0 : chainLen[k] > bestLen) {
      bestLen = chainLen[k];
      bestEnd = k;
    }
  }

  if (bestLen < minConfidentFixes || bestEnd === -1) {
    return undefined;
  }

  const chainSet = new Set<number>();
  for (let curr = bestEnd; curr !== -1; curr = parent[curr]) {
    chainSet.add(sessionStart + curr);
  }

  // Find the longest disjoint chain outside the winning chain.
  // To be confident about the track's location, the winning chain must be at least
  // `confidenceRatio` times longer than any competing disjoint chain (unless tie-breaking on the client).
  if (!preferLatestOnTie) {
    let secondBestLen = 0;
    for (let k = 0; k < sessionLength; k++) {
      if (
        !chainSet.has(sessionStart + k) &&
        (parent[k] === -1 || !chainSet.has(sessionStart + parent[k])) &&
        chainLen[k] > secondBestLen
      ) {
        secondBestLen = chainLen[k];
      }
    }
    if (bestLen < confidenceRatio * secondBestLen) {
      return undefined;
    }
  }

  return chainSet;
}

/**
 * Filters GPS speed outliers and invalid fixes in the active flight session.
 *
 * Strategy:
 * 1. Operates on the active session (fixes after any time gap > 1h).
 * 2. Keeps fixes tentative until confidence (5+ fixes, 3x dominance over competing clusters) is established.
 * 3. Fast path: evaluates delta fixes in O(delta) against the anchor when the session start is clean.
 * 4. Full consensus: finds the longest kinematically reachable chain if cold-start outliers exist.
 *
 * @param track - The live track to filter.
 * @param options - Optional thresholds and `filterFromSec` delta timestamp.
 * @returns The filtered live track (or original `track` if no fixes were pruned).
 */
export function filterLiveTrackOutliers(
  track: protos.LiveTrack,
  options: LiveTrackFilterOptions = {},
): protos.LiveTrack {
  const {
    filterFromSec,
    maxSpeedKmh = MAX_LIVE_SPEED_KMH,
    maxGapSec = LIVE_GAP_RESET_SEC,
    minConfidentFixes = MIN_CONFIDENT_FIXES,
    confidenceRatio = CONFIDENCE_RATIO,
  } = options;

  const len = track.timeSec.length;
  const sessionStart = getActiveSessionStartIndex(track.timeSec, maxGapSec);
  const sessionLength = len - sessionStart;

  if (sessionLength < minConfidentFixes) {
    return track;
  }

  // Check if the first MIN_CONFIDENT_FIXES fixes at the start of the active session are clean (no outliers).
  let hasCleanStart = sessionLength >= MIN_CONFIDENT_FIXES && isTrackFixValid(track, sessionStart);
  if (hasCleanStart) {
    for (let i = sessionStart + 1; i < sessionStart + MIN_CONFIDENT_FIXES; i++) {
      if (!isReachable(track, i - 1, i, maxSpeedKmh)) {
        hasCleanStart = false;
        break;
      }
    }
  }

  if (hasCleanStart) {
    const cleanStartEndIdx = sessionStart + MIN_CONFIDENT_FIXES - 1;
    let startIdx = cleanStartEndIdx + 1;
    let anchorIdx = cleanStartEndIdx;

    // When filterFromSec is provided (e.g. earliest delta timestamp in the current server tick),
    // skip already-validated fixes and evaluate only from filterFromSec onwards against the preceding valid anchor.
    if (filterFromSec != null && filterFromSec > track.timeSec[cleanStartEndIdx]) {
      const fromIdx = findFirstIndex(track.timeSec, filterFromSec, Comparison.GREATER_EQUAL);
      if (fromIdx > startIdx) {
        let prevValidIdx = fromIdx - 1;
        while (
          prevValidIdx >= sessionStart &&
          (!isTrackFixValid(track, prevValidIdx) || isProtectedFix(track, prevValidIdx))
        ) {
          prevValidIdx--;
        }
        if (prevValidIdx >= sessionStart) {
          startIdx = fromIdx;
          anchorIdx = prevValidIdx;
        }
      }
    }

    let droppedIndices: Set<number> | undefined;
    let droppedClusterCount = 0;
    let droppedClusterLastIdx = -1;
    let needsFullConsensus = false;

    for (let i = startIdx; i < len; i++) {
      if (isReachable(track, anchorIdx, i, maxSpeedKmh)) {
        anchorIdx = i;
        droppedClusterCount = 0;
        droppedClusterLastIdx = -1;
      } else {
        droppedIndices ??= new Set<number>();
        droppedIndices.add(i);
        if (isTrackFixValid(track, i)) {
          if (droppedClusterLastIdx === -1 || isReachable(track, droppedClusterLastIdx, i, maxSpeedKmh)) {
            droppedClusterCount++;
          } else {
            droppedClusterCount = 1;
          }
          droppedClusterLastIdx = i;
          // If a dropped cluster reaches minConfidentFixes, fall back to full-session consensus
          // so we do not stay locked on a stale initial anchor.
          if (droppedClusterCount >= minConfidentFixes) {
            needsFullConsensus = true;
            break;
          }
        } else {
          droppedClusterCount = 0;
          droppedClusterLastIdx = -1;
        }
      }
    }

    if (!needsFullConsensus) {
      return droppedIndices ? pruneAndRecordOutliers(track, droppedIndices) : track;
    }
  }

  // Beginning of the session has outliers (or a competing cluster was detected):
  // evaluate full-session consensus before pruning.
  const preferLatestOnTie = minConfidentFixes < MIN_CONFIDENT_FIXES;
  const chainSet = findConsensusChain(
    track,
    sessionStart,
    sessionLength,
    maxSpeedKmh,
    minConfidentFixes,
    confidenceRatio,
    preferLatestOnTie,
  );

  if (!chainSet) {
    return track;
  }

  const droppedIndices = new Set<number>();
  for (let i = sessionStart; i < len; i++) {
    if (!chainSet.has(i)) {
      droppedIndices.add(i);
    }
  }

  return pruneAndRecordOutliers(track, droppedIndices);
}
