// Filter altitude spikes using a physical rate-of-climb & Hampel outlier filter.
// Compute the heading.

import type { RuntimeTrack } from '@flyxc/common';
import { arrayMax, arrayMin, computeVerticalSpeed } from '@flyxc/common';
import { getRhumbLineBearing } from 'geolib';

export type Request = Pick<RuntimeTrack, 'alt' | 'id' | 'lat' | 'lon' | 'timeSec'>;

export type Response = Pick<
  RuntimeTrack,
  'alt' | 'heading' | 'lookAtLat' | 'lookAtLon' | 'id' | 'maxAlt' | 'minAlt' | 'maxVz' | 'minVz' | 'vz'
>;

// Maximum physically possible climb rate (m/s) in atmospheric flight (paragliding/gliding/light aircraft).
// Thermal and mountain wave climb rates rarely exceed +15 to +18 m/s.
// Instantaneous climb exceeding 25 m/s indicates an instrument anomaly or GPS glitch.
const MAX_CLIMB_VZ_MPSEC = 25;

// Maximum physically possible sink rate (m/s).
// While paraglider spiral dives reach -20 to -25 m/s, sailplanes using airbrakes
// or light aircraft in emergency descents can reach -40 to -50 m/s.
// Instantaneous sink exceeding 60 m/s indicates an instrument anomaly or GPS glitch.
const MAX_SINK_VZ_MPSEC = 60;

// Minimum altitude deviation (meters) from the local median required to classify an outlier as a spike.
// Minor sensor noise or small fluctuations (< 20 m) are left untouched.
const MIN_SPIKE_DIFF_M = 20;

// Minimum local median altitude (meters) required to classify a fix <= 0 as a GPS dropout.
// Prevents falsely treating legitimate low-altitude flights (e.g. coastal dune or Dead Sea soaring) as dropouts.
const MIN_DROPOUT_ALT_M = 100;

// Maximum time window (seconds) to search for neighboring fixes around the current point.
const TIME_WINDOW_SEC = 30;

// Minimum number of valid neighbor points to collect on each side before stopping the time window search.
const MIN_POINTS = 2;

// Maximum number of neighbor points to collect on each side.
const MAX_POINTS = 5;

// Maximum allowed time gap (seconds) between fixes. Segments across a gap (e.g. instrument pause)
// are not treated as continuous neighbors.
const MAX_GAP_SEC = 60;

/**
 * Computes the median of a small array (N <= 10) in-place.
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
 * Removes isolated altitude spikes and GPS dropouts without altering genuine altitudes or clipping thermal peaks.
 *
 * This Hampel-style outlier filter only modifies an altitude point if:
 * 1. The instantaneous vertical rate from the preceding fix exceeds physical flight limits
 *    (climb > MAX_CLIMB_VZ_MPSEC or sink > MAX_SINK_VZ_MPSEC, accommodating paragliders, sailplanes, and light aircraft)
 *    AND the point deviates significantly (> MIN_SPIKE_DIFF_M) from its local neighborhood median, OR
 * 2. It represents a zero/negative GPS dropout while flying at altitude (> MIN_DROPOUT_ALT_M).
 *
 * Note: `altitude` is updated in place.
 *
 * @param altitude - Array of altitudes in meters (modified in place).
 * @param timeSecs - Monotonically increasing timestamps in seconds corresponding to each fix.
 */
export function filterSpikes(altitude: number[], timeSecs: number[]): void {
  const len = altitude.length;
  if (len < 3) {
    return;
  }

  // Create a copy of the original values for forward neighbor lookups.
  const unfilteredAlt = [...altitude];

  // Reusable buffer to collect neighbor altitudes for candidate spikes without per-point allocations.
  const neighbors: number[] = [];

  for (let i = 0; i < len; i++) {
    const timeS = timeSecs[i];
    const alt = unfilteredAlt[i];

    // Compute vertical speed from the previous fix (using the cleaned altitude for i - 1).
    let vzPrev = 0;
    let dtPrev = 1;
    if (i > 0) {
      dtPrev = timeS - timeSecs[i - 1];
      if (dtPrev <= MAX_GAP_SEC) {
        vzPrev = (alt - altitude[i - 1]) / Math.max(1, dtPrev);
      }
    }

    // For the initial fix (i = 0), check vertical speed to the next fix since no previous fix exists.
    let vzNext = 0;
    let dtNext = 1;
    if (i === 0) {
      dtNext = timeSecs[1] - timeS;
      if (dtNext <= MAX_GAP_SEC) {
        vzNext = (unfilteredAlt[1] - alt) / Math.max(1, dtNext);
      }
    }

    // Check if vertical rate exceeds physical flight limits.
    const isExtremePrev = vzPrev > MAX_CLIMB_VZ_MPSEC || vzPrev < -MAX_SINK_VZ_MPSEC;
    const isExtremeNext = vzNext > MAX_CLIMB_VZ_MPSEC || vzNext < -MAX_SINK_VZ_MPSEC;
    const hasExtremeJump = i === 0 ? isExtremeNext : isExtremePrev;

    const isZeroDropoutCandidate = alt <= 0;

    // Fast path: In normal flight, vertical speed is well within physical limits.
    // Points with normal vertical speed and positive altitude are skipped immediately with zero allocations.
    if (!hasExtremeJump && !isZeroDropoutCandidate) {
      continue;
    }

    // Outlier candidate detected: inspect local neighbors in a +/- 30s window.
    neighbors.length = 0;

    // Collect backward neighbors (using cleaned altitudes).
    for (let j = i - 1; j >= 0; j--) {
      const dt = timeS - timeSecs[j];
      if (dt > MAX_GAP_SEC) {
        break;
      }
      if (dt > TIME_WINDOW_SEC && neighbors.length >= MIN_POINTS) {
        break;
      }
      if (altitude[j] > 0) {
        neighbors.push(altitude[j]);
      }
      if (neighbors.length >= MAX_POINTS) {
        break;
      }
    }

    const leftCount = neighbors.length;

    // Collect forward neighbors.
    for (let j = i + 1; j < len; j++) {
      const dt = timeSecs[j] - timeS;
      if (dt > MAX_GAP_SEC) {
        break;
      }
      if (dt > TIME_WINDOW_SEC && neighbors.length - leftCount >= MIN_POINTS) {
        break;
      }
      if (unfilteredAlt[j] > 0) {
        neighbors.push(unfilteredAlt[j]);
      }
      if (neighbors.length - leftCount >= MAX_POINTS) {
        break;
      }
    }

    if (neighbors.length === 0) {
      continue;
    }

    // Calculate local median of the collected neighbors.
    const median = computeMedian(neighbors);

    const diff = Math.abs(alt - median);
    const effectiveDt = i === 0 ? dtNext : dtPrev;
    const minDiff = Math.min(MIN_SPIKE_DIFF_M, Math.max(5, MAX_CLIMB_VZ_MPSEC * effectiveDt));
    const isSpike = diff > minDiff && hasExtremeJump;
    const isDropout = isZeroDropoutCandidate && median > MIN_DROPOUT_ALT_M && diff > minDiff;

    // Replace outlier with the local median.
    if (isSpike || isDropout) {
      altitude[i] = median;
    }
  }
}

// Compute the heading between each points.
function computeHeading(lat: number[], lon: number[]): number[] {
  const heading = [];
  let previousPoint = { lat: lat[0], lon: lon[0] };

  for (let i = 0; i < lat.length; i++) {
    const currentPoint = { lat: lat[i], lon: lon[i] };
    heading.push(Math.round(getRhumbLineBearing(previousPoint, currentPoint)));
    previousPoint = currentPoint;
  }

  return heading;
}

// Low pass filter to compute the camera lookAt position.
// see:
// - https://github.com/rochars/low-pass-filter
// - https://observablehq.com/@vicb/filter-camera-position
function filterPosition(lat: number[], lon: number[], timeSecs: number[]) {
  const len = timeSecs.length;

  let currentIndex = 0;
  let currentSec = timeSecs[0];

  // Generates one sample for every seconds (buffering the last value if needed).
  // The last value gets duplicated to account for the filter delay.
  const getNextIndex = (): { hasFix: boolean; index: number } => {
    if (currentIndex >= len) {
      return { hasFix: true, index: len - 1 };
    }
    let hasFix = false;
    const index = currentIndex;
    currentSec += 1;
    if (currentSec >= timeSecs[currentIndex]) {
      hasFix = true;
      currentIndex++;
    }
    return { hasFix, index };
  };

  const filterDelay = 50;
  const fCutoff = 0.002;
  const fSampling = 1;

  const rc = 1.0 / (fCutoff * 2 * Math.PI);
  const dt = 1.0 / fSampling;
  const alpha = dt / (rc + dt);
  let lastLat = lat[0];
  let lastLon = lon[0];

  const lowPass = (index: number) => {
    lastLat = lastLat + alpha * (lat[index] - lastLat);
    lastLon = lastLon + alpha * (lon[index] - lastLon);
  };

  // Start using the output after the delay.
  const lenSeconds = timeSecs[len - 1] - timeSecs[0] + filterDelay;
  let dstIdx = 0;
  for (let seconds = 0; seconds < lenSeconds; ++seconds) {
    const { hasFix, index } = getNextIndex();
    lowPass(index);
    if (seconds >= filterDelay && hasFix) {
      lat[dstIdx] = lastLat;
      lon[dstIdx] = lastLon;
      dstIdx++;
    }
  }

  // Compensate for the delay.
  for (let i = 0, dstIdx = len - filterDelay; i < filterDelay; ++i, dstIdx++) {
    lowPass(len - 1);
    lat[dstIdx] = lastLat;
    lon[dstIdx] = lastLon;
  }
}

const w: Worker = self as any;

w.addEventListener('message', (message: MessageEvent<Request>) => {
  const { alt, id, lat, lon, timeSec } = message.data;

  filterSpikes(alt, timeSec);
  const heading = computeHeading(lat, lon);

  const vz = computeVerticalSpeed(alt, timeSec);
  const minAlt = arrayMin(alt);
  const maxAlt = arrayMax(alt);
  const minVz = arrayMin(vz);
  const maxVz = arrayMax(vz);

  filterPosition(lat, lon, timeSec);

  w.postMessage({ alt, heading, id, lookAtLat: lat, lookAtLon: lon, maxAlt, minAlt, maxVz, minVz, vz });
});
