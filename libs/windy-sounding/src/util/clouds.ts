import type { MeteogramDataHash } from '@windy/interfaces';

import { lerp, scaleLinear } from './math';

// Set to true du debug the clouds.
export const DEBUG_CLOUDS = false;
export let debugCloudCanvas: HTMLCanvasElement | undefined;
export let debugCloudTimeCursor: HTMLDivElement | undefined;

export type PeriodCloud = {
  clouds: number[];
  width: number;
  height: number;
};

export type CloudCoverGenerator = (pressure: number, toPressure?: number) => number;

const CLOUD_PRESSURE_WEIGHT = [0, 5, 11, 16.7, 25, 33.4, 50, 58.4, 66.7, 75, 83.3, 92, 98, 100].map((w) => w / 100);
const CLOUD_LEVELS = [1000, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 200, 150, 100];
const CLOUD_LOOKUP = new Uint8Array(256);

for (let i = 0; i < 160; i++) {
  CLOUD_LOOKUP[i] = clampIndex(24 * Math.floor((i + 12) / 16), 160);
}

// Compute the rain clouds cover.
// Output an object:
// - clouds: the clouds cover,
// - width & height: dimension of the cover data.
export function computePeriodClouds(windyDataHash: MeteogramDataHash): PeriodCloud {
  // Compute clouds data.
  const timeDimension = windyDataHash['rh-1000h'].length;
  const ghDimension = CLOUD_LEVELS.length;
  const rawClouds = new Array(timeDimension * ghDimension).fill(0.0);

  for (let ghIndex = 1, index = timeDimension; ghIndex < ghDimension - 1; ++ghIndex) {
    const weight = CLOUD_PRESSURE_WEIGHT[ghIndex];
    const pAdd = lerp(-60, -70, weight);
    const pMul = lerp(0.025, 0.038, weight);
    const pPow = lerp(6, 4, weight);
    const pMul2 = 1 - 0.8 * Math.pow(weight, 0.7);
    const rhKey = `rh-${CLOUD_LEVELS[ghIndex]}h`;
    if (!(rhKey in windyDataHash)) {
      throw Error(`Missing ${rhKey}`);
    }
    // as `rh-500h` is to please TypeScript strict mode
    const rhByTime = windyDataHash[`rh-${CLOUD_LEVELS[ghIndex]}h` as `rh-500h`];
    for (let timeIndex = 0; timeIndex < timeDimension; ++timeIndex) {
      const rh = rhByTime[timeIndex];
      const cappedV = Math.max(0.0, Math.min((rh + pAdd) * pMul, 1.0));
      rawClouds[index++] = cappedV ** pPow * pMul2;
    }
  }

  // Interpolate raw clouds.
  const sliceWidth = 4;
  const width = sliceWidth * timeDimension;
  const height = 300;
  const clouds = new Array(width * height);
  const kh = height - 1;
  const dx2 = (sliceWidth + 1) >> 1;
  let heightLookupIndex = 2 * height;
  const heightLookup = new Array(heightLookupIndex);
  const buffer = new Array(16);
  let previousY;
  let currentY = height;

  for (let ghIndex = 0; ghIndex < ghDimension - 1; ++ghIndex) {
    previousY = currentY;
    currentY = Math.round(height - 1 - CLOUD_PRESSURE_WEIGHT[ghIndex + 1] * kh);
    const j0 = timeDimension * clampIndex(ghIndex + 2, ghDimension);
    const j1 = timeDimension * clampIndex(ghIndex + 1, ghDimension);
    const j2 = timeDimension * clampIndex(ghIndex + 0, ghDimension);
    const j3 = timeDimension * clampIndex(ghIndex - 1, ghDimension);
    let previousX = 0;
    let currentX = dx2;
    const deltaY = previousY - currentY;

    for (let timeIndex = 0; timeIndex < timeDimension + 1; ++timeIndex) {
      if (timeIndex == 0 && deltaY > 0) {
        for (let l = 0; l < deltaY; l++) {
          heightLookup[--heightLookupIndex] = ghIndex;
          heightLookup[--heightLookupIndex] = Math.round((10000 / deltaY) * l);
        }
      }
      const i0 = clampIndex(timeIndex - 2, timeDimension);
      const i1 = clampIndex(timeIndex - 1, timeDimension);
      const i2 = clampIndex(timeIndex + 0, timeDimension);
      const i3 = clampIndex(timeIndex + 1, timeDimension);
      buffer[0] = rawClouds[j0 + i0];
      buffer[1] = rawClouds[j0 + i1];
      buffer[2] = rawClouds[j0 + i2];
      buffer[3] = rawClouds[j0 + i3];
      buffer[4] = rawClouds[j1 + i0];
      buffer[5] = rawClouds[j1 + i1];
      buffer[6] = rawClouds[j1 + i2];
      buffer[7] = rawClouds[j1 + i3];
      buffer[8] = rawClouds[j2 + i0];
      buffer[9] = rawClouds[j2 + i1];
      buffer[10] = rawClouds[j2 + i2];
      buffer[11] = rawClouds[j2 + i3];
      buffer[12] = rawClouds[j3 + i0];
      buffer[13] = rawClouds[j3 + i1];
      buffer[14] = rawClouds[j3 + i2];
      buffer[15] = rawClouds[j3 + i3];

      const topLeft = currentY * width + previousX;
      const deltaX = currentX - previousX;

      for (let y = 0; y < deltaY; ++y) {
        let offset = topLeft + y * width;
        for (let x = 0; x < deltaX; ++x) {
          const black = step(bicubicFiltering(buffer, x / deltaX, y / deltaY) * 160.0);
          clouds[offset++] = 255 - black;
        }
      }

      previousX = currentX;
      currentX += sliceWidth;

      currentX = Math.min(currentX, width);
    }
  }

  if (DEBUG_CLOUDS) {
    cloudsToCanvas({ clouds, width, height });
  }

  return { clouds, width, height };
}

export function getCloudCoverGenerator(cloudCover: number[]): CloudCoverGenerator {
  const coverLength = cloudCover.length;
  const weightedIndexes = CLOUD_PRESSURE_WEIGHT.map((w) => w * (coverLength - 1));
  const pressureToIndexScale = scaleLinear(CLOUD_LEVELS, weightedIndexes);
  return (pressure: number, toPressure: number | undefined): number => {
    const startIdx = Math.max(0, Math.round(pressureToIndexScale(pressure)));
    if (toPressure == undefined) {
      return cloudCover[startIdx];
    }
    const endIdx = Math.max(startIdx, Math.round(pressureToIndexScale(toPressure)));
    const slice = cloudCover.slice(startIdx, endIdx);
    return slice.length ? Math.min(...slice) : 255;
  };
}

/**
 * Clamps an index to the range [0, size - 1].
 *
 * @param index - The index to clamp.
 * @param size - The size of the range.
 * @returns The clamped index.
 */
function clampIndex(index: number, size: number): number {
  return index < 0 ? 0 : index > size - 1 ? size - 1 : index;
}

/**
 * Applies a step function to a value.
 *
 * @param x - The value to apply the step function to.
 * @returns The stepped value.
 */

function step(x: number): number {
  return CLOUD_LOOKUP[Math.floor(clampIndex(x, 160))];
}

/**
 * Performs cubic interpolation.
 *
 * @param y0 - The value at x = 0.
 * @param y1 - The value at x = 1.
 * @param y2 - The value at x = 2.
 * @param y3 - The value at x = 3.
 * @param m - The interpolation parameter.
 * @returns The interpolated value.
 */
function cubicInterpolate(y0: number, y1: number, y2: number, y3: number, m: number): number {
  const a0 = -y0 * 0.5 + 3.0 * y1 * 0.5 - 3.0 * y2 * 0.5 + y3 * 0.5;
  const a1 = y0 - 5.0 * y1 * 0.5 + 2.0 * y2 - y3 * 0.5;
  const a2 = -y0 * 0.5 + y2 * 0.5;
  return a0 * m ** 3 + a1 * m ** 2 + a2 * m + y1;
}

/**
 * Performs bicubic filtering.
 *
 * @param m - The 4x4 matrix of values.
 * @param s - The interpolation parameter in the x direction.
 * @param t - The interpolation parameter in the y direction.
 * @returns The filtered value.
 */
function bicubicFiltering(m: number[], s: number, t: number) {
  return cubicInterpolate(
    cubicInterpolate(m[0], m[1], m[2], m[3], s),
    cubicInterpolate(m[4], m[5], m[6], m[7], s),
    cubicInterpolate(m[8], m[9], m[10], m[11], s),
    cubicInterpolate(m[12], m[13], m[14], m[15], s),
    t,
  );
}

/**
 * Draws the clouds on a canvas.
 *
 * This function is useful for debugging.
 *
 * @param clouds - The clouds data.
 * @param width - The width of the canvas.
 * @param height - The height of the canvas.
 * @param canvas - The canvas to draw on.
 * @returns The canvas.
 */
export function cloudsToCanvas({ clouds, width, height }: PeriodCloud) {
  if (!debugCloudCanvas) {
    const style = document.createElement('style');
    style.appendChild(
      document.createTextNode(`.wsp-cloud-debug {
        position: fixed;
        bottom: 500px;
        left: 0;
      }
      canvas.wsp-cloud-debug {
        background-color: white;
      }
      div.wsp-cloud-debug {
        border-right: 1px solid red;
        backround-color: transparent;
      }
    `),
    );
    document.head.append(style);
    debugCloudCanvas = document.createElement('canvas');
    debugCloudCanvas.className = 'wsp-cloud-debug';
    debugCloudCanvas.width = width;
    debugCloudCanvas.height = height;
    document.body.append(debugCloudCanvas);
    debugCloudTimeCursor = document.createElement('div');
    debugCloudTimeCursor.className = 'wsp-cloud-debug';
    debugCloudTimeCursor.style.height = `${height}px`;
    document.body.append(debugCloudTimeCursor);
  }

  const ctx: CanvasRenderingContext2D = debugCloudCanvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);
  const imgData = imageData.data;

  let srcOffset = 0;
  let dstOffset = 0;
  for (let x = 0; x < width; ++x) {
    for (let y = 0; y < height; ++y) {
      const color = clouds[srcOffset++];
      imgData[dstOffset++] = color;
      imgData[dstOffset++] = color;
      imgData[dstOffset++] = color;
      imgData[dstOffset++] = color < 250 ? 255 : 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  ctx.drawImage(debugCloudCanvas, 0, 0, width, height);
}
