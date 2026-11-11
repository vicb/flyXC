// Maximum physically possible climb rate (m/s) in atmospheric flight (paragliding/gliding/light aircraft).
// Thermal and mountain wave climb rates rarely exceed +15 to +18 m/s.
// Instantaneous climb exceeding 25 m/s indicates an instrument anomaly or GPS glitch.
const MAX_CLIMB_VZ_MPSEC = 25;

// Maximum physically possible sink rate (m/s).
// While paraglider spiral dives reach -20 to -25 m/s, sailplanes using airbrakes
// or light aircraft in emergency descents can reach -40 to -50 m/s.
// Instantaneous sink exceeding 60 m/s indicates an instrument anomaly or GPS glitch.
const MAX_SINK_VZ_MPSEC = 60;

// Minimum step vertical rate (m/s) and altitude jump (m) to trigger excursion bridging.
// Genuine maneuvers (spirals, airbrakes, wave climbs) are monotonic and do not rebound to the pre-step chord.
const MIN_EXCURSION_VZ_MPSEC = 9;
const MIN_EXCURSION_DIFF_M = 9;

// Maximum duration (seconds) of a transient spike + exponential Kalman recovery tail to bridge.
const MAX_BRIDGE_SEC = 25;

// Maximum chord vertical speed (m/s) and slope change (m/s) allowed when reconnecting across an excursion.
const MAX_CHORD_VZ_MPSEC = 12;
const MAX_SLOPE_CHANGE_VZ_MPSEC = 6;

// Maximum vertical speed deviation (m/s) at the reconnection point to confirm recovery has settled.
const MAX_POST_STEP_DIFF_VZ_MPSEC = 3.5;

// Minimum recovery vertical speed excess (m/s) over settled post-reconnection speed (or chord speed at track end)
// to confirm the track rapidly rebounded from an excursion rather than transitioning from a climb into a glide.
const MIN_RECOVERY_EXCESS_VZ_MPSEC = 2.5;

// Minimum altitude deviation (meters) from the local median required to classify an extreme jump as a spike.
// Minor sensor noise or small fluctuations (< 20 m) are left untouched.
const MIN_SPIKE_DIFF_M = 20;

// Minimum local median altitude (meters) required to classify a fix <= 0 as a GPS dropout.
// Prevents falsely treating legitimate low-altitude flights (e.g. coastal dune or Dead Sea soaring) as dropouts.
const MIN_DROPOUT_ALT_M = 100;

// Maximum time window (seconds) to search for neighboring fixes around the current point.
const TIME_WINDOW_SEC = 30;

// Minimum number of valid neighbor points to collect on each side before stopping the time window search.
const MIN_POINTS = 2;

// Maximum number of neighbor points to collect on each side (allows spanning multi-second 1 Hz glitch bursts).
const MAX_POINTS = 15;

// Maximum allowed time gap (seconds) between fixes. Segments across a gap (e.g. instrument pause)
// are not treated as continuous neighbors.
const MAX_GAP_SEC = 60;

// Returns true when a non-extreme `alt <= 0` fix stays non-positive across the lookahead window (or follows a
// low-altitude fix) without an out-of-limit jump or rebound above zero.
function isSustainedNonPositive(altitude: number[], timeSecs: number[], index: number, len: number): boolean {
  if (altitude[index - 1] <= 0) {
    return true;
  }
  const timeS = timeSecs[index];
  let sawNegative = false;
  for (let k = index + 1; k < len; k++) {
    const dtStep = timeSecs[k] - timeSecs[k - 1];
    if (dtStep > MAX_GAP_SEC || timeSecs[k] - timeS > TIME_WINDOW_SEC) {
      break;
    }
    const vzStep = (altitude[k] - altitude[k - 1]) / Math.max(1, dtStep);
    if (vzStep > MAX_CLIMB_VZ_MPSEC || vzStep < -MAX_SINK_VZ_MPSEC) {
      return false;
    }
    if (altitude[k] < 0) sawNegative = true;
    if (altitude[k] > 0) return false;
  }
  return sawNegative || altitude[index - 1] <= MIN_DROPOUT_ALT_M;
}

/**
 * Searches forward from `excursionIdx` (with preceding anchor `excursionIdx - 1`) for the earliest
 * settled fix where a transient excursion returns onto the normal flight trajectory.
 */
function findBridgeReconnection(
  altitude: number[],
  timeSecs: number[],
  excursionIdx: number,
  len: number,
  isExtremeJump: boolean,
  hasBaseline: boolean,
  baseVz: number,
): number {
  const alt = altitude[excursionIdx];
  const anchorAlt = altitude[excursionIdx - 1];
  const anchorTime = timeSecs[excursionIdx - 1];
  const dtFirst = timeSecs[excursionIdx] - anchorTime;
  if (dtFirst <= 0 || dtFirst > MAX_GAP_SEC) {
    return -1;
  }

  const jumpSign = alt >= anchorAlt ? 1 : -1;
  // Allow extreme-jump plateaus (exceeding physical climb/sink limits) to bridge up to MAX_GAP_SEC.
  const maxBridgeSec = isExtremeJump ? MAX_GAP_SEC : MAX_BRIDGE_SEC;
  // Protect in-limit 2+ fix ramps (climb or dive) unless a step inside the candidate bridge exceeds physical limits.
  const dtSecond = excursionIdx + 1 < len ? timeSecs[excursionIdx + 1] - timeSecs[excursionIdx] : 0;
  const isContinuingRamp =
    !isExtremeJump && dtSecond > 0 && dtSecond <= MAX_GAP_SEC && jumpSign * (altitude[excursionIdx + 1] - alt) > 0;
  let hasOutOfLimitStep = false;
  let peakSignedAlt = jumpSign * alt;
  let peakIdx = excursionIdx;

  for (let r = excursionIdx + 1; r < len; r++) {
    const prevSignedAlt = jumpSign * altitude[r - 1];
    if (prevSignedAlt >= peakSignedAlt) {
      peakSignedAlt = prevSignedAlt;
      peakIdx = r - 1;
    }

    const dtChord = timeSecs[r] - anchorTime;
    if (dtChord <= 0) continue;
    const dtStep = timeSecs[r] - timeSecs[r - 1];
    if (dtChord > maxBridgeSec || dtStep > MAX_GAP_SEC) break;
    if (dtStep >= 0) {
      const stepVz = (altitude[r] - altitude[r - 1]) / Math.max(1, dtStep);
      if (stepVz > MAX_CLIMB_VZ_MPSEC || stepVz < -MAX_SINK_VZ_MPSEC) {
        hasOutOfLimitStep = true;
      }
    }
    if (altitude[r] <= 0 && anchorAlt > MIN_DROPOUT_ALT_M) continue;

    // Chord must be physically in-limit, match any established baseline slope, or stay within MAX_CHORD_VZ_MPSEC.
    const chordVz = (altitude[r] - anchorAlt) / dtChord;
    if (chordVz > MAX_CLIMB_VZ_MPSEC || chordVz < -MAX_SINK_VZ_MPSEC) continue;
    if (hasBaseline ? Math.abs(chordVz - baseVz) > MAX_SLOPE_CHANGE_VZ_MPSEC : Math.abs(chordVz) > MAX_CHORD_VZ_MPSEC) {
      continue;
    }

    // Confirm the excursion peaked away from both `anchorAlt` and `altitude[r]` and deviated from the chord.
    const peakDiffFromAnchor = peakSignedAlt - jumpSign * anchorAlt;
    const peakDiffFromR = peakSignedAlt - jumpSign * altitude[r];
    if (
      Math.abs(alt - (anchorAlt + chordVz * dtFirst)) < MIN_EXCURSION_DIFF_M * 0.75 ||
      peakDiffFromAnchor < MIN_EXCURSION_DIFF_M ||
      peakDiffFromR < 5
    ) {
      continue;
    }

    // Verify post-reconnection steps (r -> r + 1 -> r + 2) have settled onto the chord slope.
    let settledVz = chordVz;
    if (r + 1 < len) {
      const dtS = timeSecs[r + 1] - timeSecs[r];
      if (dtS > 0 && dtS <= MAX_GAP_SEC) {
        const vzS = (altitude[r + 1] - altitude[r]) / dtS;
        if (Math.abs(vzS - chordVz) > MAX_POST_STEP_DIFF_VZ_MPSEC) continue;
        if (r + 2 < len) {
          const dtS2 = timeSecs[r + 2] - timeSecs[r + 1];
          if (dtS2 > 0 && dtS2 <= MAX_GAP_SEC) {
            const vzS2 = (altitude[r + 2] - altitude[r + 1]) / dtS2;
            if (-jumpSign * (vzS2 - chordVz) > MAX_POST_STEP_DIFF_VZ_MPSEC) continue;
          }
        }
        settledVz = vzS;
      }
    }

    // Require recovery faster than post-reconnection flight rate to distinguish glitches from climb-to-glide exits.
    const dtRecovery = timeSecs[r] - timeSecs[peakIdx];
    if (dtRecovery <= 0) continue;
    const vzRecovery = (altitude[r] - altitude[peakIdx]) / dtRecovery;
    if (-jumpSign * (vzRecovery - settledVz) < MIN_RECOVERY_EXCESS_VZ_MPSEC) continue;

    return isContinuingRamp && !hasOutOfLimitStep ? -1 : r;
  }

  return -1;
}

/**
 * Computes the median of a small array (N <= 30) in-place.
 *
 * Uses an in-place insertion sort which is > 5x faster than Array.prototype.sort((a, b) => a - b)
 * for small collections because it eliminates V8 comparator callback invocation overhead.
 *
 * @param arr - Array of numbers to sort and find the median of (modified in place).
 * @returns The median value rounded to the nearest integer.
 */
export function computeMedian(arr: number[]): number {
  const len = arr.length;
  for (let i = 1; i < len; i++) {
    const val = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > val) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = val;
  }
  const mid = Math.floor(len / 2);
  return len % 2 === 1 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/**
 * Result of the spike filtering process containing the computed altitude bounds.
 */
type AltitudeBounds = {
  maxAlt: number;
  minAlt: number;
};

/**
 * Removes altitude spikes, exponential recovery tails, and GPS dropouts without altering genuine flight maneuvers.
 *
 * Combines two complementary mechanisms:
 * 1. **Excursion bridging**: When an abrupt positive-altitude vertical step (`>= MIN_EXCURSION_VZ_MPSEC` and
 *    `>= MIN_EXCURSION_DIFF_M`, either extreme or deviating `>= MIN_EXCURSION_VZ_MPSEC` from the recent vertical speed)
 *    occurs, searches forward up to `MAX_BRIDGE_SEC` (or `MAX_GAP_SEC` for extreme jumps) for the point where the
 *    track settles back onto its normal flight trajectory and linearly interpolates across the excursion. Because
 *    genuine steep maneuvers (spirals, sailplane airbrakes, wave climbs, dives) are monotonic and do not rebound to
 *    the pre-maneuver chord, they are never modified.
 * 2. **Hampel window-median fallback**: For un-bridgeable extreme jumps (`> MAX_CLIMB_VZ_MPSEC` or `< -MAX_SINK_VZ_MPSEC`,
 *    such as isolated glitches during a `-35 m/s` dive, wide plateaus, or boundary spikes) and GPS zero dropouts while
 *    flying at altitude (`> MIN_DROPOUT_ALT_M`), replaces the outlier with the local median of positive-altitude
 *    neighbors (within `+/- TIME_WINDOW_SEC`, or up to `MAX_GAP_SEC` when fewer than `MIN_POINTS` are found).
 *
 * Note: `altitude` is updated in place. Computes and returns `minAlt` and `maxAlt` in the same pass.
 *
 * @param altitude - Array of altitudes in meters (modified in place).
 * @param timeSecs - Monotonically increasing timestamps in seconds corresponding to each fix.
 * @returns Object containing `minAlt` and `maxAlt`.
 */
export function filterSpikes(altitude: number[], timeSecs: number[]): AltitudeBounds {
  const len = altitude.length;
  if (len === 0) {
    return { maxAlt: 0, minAlt: 0 };
  }
  if (len < 3) {
    return { maxAlt: Math.max(...altitude), minAlt: Math.min(...altitude) };
  }

  // Reusable buffer to collect neighbor altitudes for fallback median lookups without per-point allocations.
  const neighbors: number[] = [];
  let minAlt = Infinity;
  let maxAlt = -Infinity;

  for (let i = 0; i < len; i++) {
    const timeS = timeSecs[i];
    const alt = altitude[i];

    // Compute vertical speed from the cleaned previous fix (or to the next fix at a segment start).
    const dtPrev = i > 0 ? timeS - timeSecs[i - 1] : MAX_GAP_SEC + 1;
    const hasPrevFix = dtPrev <= MAX_GAP_SEC;
    const vzPrev = hasPrevFix ? (alt - altitude[i - 1]) / Math.max(1, dtPrev) : 0;
    const rawDtNext = !hasPrevFix && i < len - 1 ? timeSecs[i + 1] - timeS : MAX_GAP_SEC + 1;
    const hasNextFix = rawDtNext <= MAX_GAP_SEC;
    const dtNext = hasNextFix ? rawDtNext : 1;
    const vzCheck = hasPrevFix ? vzPrev : hasNextFix ? (altitude[i + 1] - alt) / Math.max(1, dtNext) : 0;

    const isExtremeJump = vzCheck > MAX_CLIMB_VZ_MPSEC || vzCheck < -MAX_SINK_VZ_MPSEC;
    const isZeroDropoutCandidate = alt <= 0;
    const isStepCandidate =
      !isZeroDropoutCandidate &&
      hasPrevFix &&
      dtPrev > 0 &&
      Math.abs(alt - altitude[i - 1]) >= MIN_EXCURSION_DIFF_M &&
      Math.abs(vzPrev) >= MIN_EXCURSION_VZ_MPSEC;

    // Fast path (~98% of fixes): skip normal fixes with zero allocations or neighbor scans.
    if (!isExtremeJump && !isStepCandidate && !isZeroDropoutCandidate) {
      if (alt < minAlt) minAlt = alt;
      if (alt > maxAlt) maxAlt = alt;
      continue;
    }

    // Preserve a clean segment start (i = 0 or post-gap) when i + 1 enters a bridgeable excursion.
    const isCleanSegmentStart =
      !hasPrevFix &&
      isExtremeJump &&
      !isZeroDropoutCandidate &&
      i + 2 < len &&
      findBridgeReconnection(altitude, timeSecs, i + 1, len, true, false, 0) !== -1;

    // 1. Try bridging transient excursions (impulses + recovery tails) to a settled reconnection fix.
    if (!isCleanSegmentStart && isStepCandidate) {
      let hasBaseline = false;
      let baseVz = 0;
      if (i > 1) {
        let b = i - 1;
        while (b > 0 && timeSecs[i - 1] - timeSecs[b] < 6 && timeSecs[b] - timeSecs[b - 1] <= MAX_GAP_SEC) {
          b--;
        }
        const dtBase = timeSecs[i - 1] - timeSecs[b];
        if (dtBase > 0) {
          baseVz = (altitude[i - 1] - altitude[b]) / dtBase;
          hasBaseline = true;
        }
      }

      if (isExtremeJump || !hasBaseline || Math.abs(vzPrev - baseVz) >= MIN_EXCURSION_VZ_MPSEC) {
        const bestR = findBridgeReconnection(altitude, timeSecs, i, len, isExtremeJump, hasBaseline, baseVz);
        if (bestR !== -1) {
          const anchorAlt = altitude[i - 1];
          const anchorTime = timeSecs[i - 1];
          const chordVz = (altitude[bestR] - anchorAlt) / (timeSecs[bestR] - anchorTime);
          for (let k = i; k < bestR; k++) {
            const interpolated = Math.round(anchorAlt + chordVz * (timeSecs[k] - anchorTime));
            altitude[k] = interpolated;
            if (interpolated < minAlt) minAlt = interpolated;
            if (interpolated > maxAlt) maxAlt = interpolated;
          }
          i = bestR - 1;
          continue;
        }
      }
    }

    // 2. Fallback to positive-altitude local median for un-bridgeable extreme jumps or GPS zero dropouts.
    const shouldCheckMedian =
      !isCleanSegmentStart &&
      (isExtremeJump ||
        (isZeroDropoutCandidate && (!hasPrevFix || !isSustainedNonPositive(altitude, timeSecs, i, len))));

    if (shouldCheckMedian) {
      neighbors.length = 0;
      for (const step of [-1, 1] as const) {
        let count = 0;
        for (let j = i + step; j >= 0 && j < len; j += step) {
          const dt = step * (timeSecs[j] - timeS);
          if (dt > MAX_GAP_SEC || (dt > TIME_WINDOW_SEC && count >= MIN_POINTS)) {
            break;
          }
          if (altitude[j] > 0) {
            neighbors.push(altitude[j]);
            if (++count >= MAX_POINTS) break;
          }
        }
      }

      if (neighbors.length > 0) {
        const median = computeMedian(neighbors);
        const diff = Math.abs(alt - median);
        const effectiveDt = Math.max(1, hasPrevFix ? dtPrev : dtNext);
        const minDiff = Math.min(MIN_SPIKE_DIFF_M, Math.max(5, MAX_CLIMB_VZ_MPSEC * effectiveDt));
        if (diff > minDiff && (isExtremeJump || (isZeroDropoutCandidate && median > MIN_DROPOUT_ALT_M))) {
          altitude[i] = median;
        }
      }
    }

    const finalAlt = altitude[i];
    if (finalAlt < minAlt) minAlt = finalAlt;
    if (finalAlt > maxAlt) maxAlt = finalAlt;
  }

  return { maxAlt, minAlt };
}
