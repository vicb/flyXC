// Filter the altitude using a median filter.
// Compute the heading.

import { computeVerticalSpeed, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { getRhumbLineBearing } from 'geolib';
import createMedianFilter from 'moving-median';

export type Request = Pick<RuntimeTrack, 'alt' | 'id' | 'lat' | 'lon' | 'timeSec'>;

export type Response = Pick<
  RuntimeTrack,
  'alt' | 'heading' | 'lookAtLat' | 'lookAtLon' | 'id' | 'maxAlt' | 'minAlt' | 'maxVz' | 'minVz' | 'vz'
>;

// Median filter:
// Window size = 2 * HALF_WINDOW_SECONDS + 1
// Delay = HALF_WINDOW_SECONDS
const HALF_WINDOW_SECONDS = 15;

// Removes the spikes using a median filter.
// `altitude` is updated in place.
// see https://observablehq.com/@vicb/filter-spikes-on-gps-tracks
function filterSpikes(altitude: number[], timeSecs: number[]) {
  const filter = createMedianFilter(2 * HALF_WINDOW_SECONDS + 1);

  const len = timeSecs.length;

  let currentSec = timeSecs[0];
  let currentAltitude = altitude[0];
  let currentIndex = 0;

  // Generates one altitude for every seconds (buffering the last value if needed).
  // The last value gets duplicated to account for the filter delay.
  const getNextAltitude = (): { hasFix: boolean; alt: number } => {
    if (currentIndex >= len) {
      return { hasFix: true, alt: altitude[len - 1] };
    }
    let hasFix = false;
    const alt = currentAltitude;
    currentSec += 1;
    if (currentSec >= timeSecs[currentIndex]) {
      hasFix = true;
      currentIndex++;
      currentAltitude = altitude[currentIndex];
    }
    return { hasFix, alt };
  };

  // Start using the output after the delay.
  const lenSeconds = Math.round(timeSecs[len - 1] - timeSecs[0]) + HALF_WINDOW_SECONDS;
  let dstIdx = 0;
  for (let seconds = 0; seconds < lenSeconds; ++seconds) {
    const { hasFix, alt } = getNextAltitude();
    const output = filter(alt);
    if (seconds >= HALF_WINDOW_SECONDS && hasFix) {
      altitude[dstIdx++] = output;
    }
  }

  // Compensate for the delay.
  for (let i = 0, dstIdx = len - HALF_WINDOW_SECONDS; i < HALF_WINDOW_SECONDS; ++i, dstIdx++) {
    altitude[dstIdx] = filter(altitude[len - 1]);
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

  // Generates one altitude for every seconds (buffering the last value if needed).
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
  const lenSeconds = Math.round(timeSecs[len - 1] - timeSecs[0]) + filterDelay;
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
  const minAlt = Math.min(...alt);
  const maxAlt = Math.max(...alt);
  const minVz = Math.min(...vz);
  const maxVz = Math.max(...vz);

  filterPosition(lat, lon, timeSec);

  w.postMessage({ alt, heading, id, lookAtLat: lat, lookAtLon: lon, maxAlt, minAlt, maxVz, minVz, vz });
});
