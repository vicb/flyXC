import { lerp } from './math';

export const hrAlt = [0, 5, 11, 16.7, 25, 33.4, 50, 58.4, 66.7, 75, 83.3, 92, 98, 100];
const hrAltPressure = [null, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 200, 150, null];

const lookup = new Uint8Array(256);

for (let i = 0; i < 160; i++) {
  lookup[i] = clampIndex(24 * Math.floor((i + 12) / 16), 160);
}

// Compute the rain clouds cover.
// Output an object:
// - clouds: the clouds cover,
// - width & height: dimension of the cover data.
export function computeClouds(airData: any) {
  // Compute clouds data.
  const numX = airData['rh-1000h'].length;
  const numY = hrAltPressure.length;
  const rawClouds = new Array(numX * numY);

  for (let y = 0, index = 0; y < numY; ++y) {
    if (hrAltPressure[y] == null) {
      for (let x = 0; x < numX; ++x) {
        rawClouds[index++] = 0.0;
      }
    } else {
      const weight = hrAlt[y] * 0.01;
      const pAdd = lerp(-60, -70, weight);
      const pMul = lerp(0.025, 0.038, weight);
      const pPow = lerp(6, 4, weight);
      const pMul2 = 1 - 0.8 * Math.pow(weight, 0.7);
      const rhRow = airData[`rh-${hrAltPressure[y]}h`];
      for (let x = 0; x < numX; ++x) {
        const hr = Number(rhRow[x]);
        let f = Math.max(0.0, Math.min((hr + pAdd) * pMul, 1.0));
        f = Math.pow(f, pPow) * pMul2;
        rawClouds[index++] = f;
      }
    }
  }

  // Interpolate raw clouds.
  const sliceWidth = 10;
  const width = sliceWidth * numX;
  const height = 300;
  const clouds = new Array(width * height);
  const kh = (height - 1) * 0.01;
  const dx2 = (sliceWidth + 1) >> 1;
  let heightLookupIndex = 2 * height;
  const heightLookup = new Array(heightLookupIndex);
  const buffer = new Array(16);
  let previousY;
  let currentY = height;

  for (let j = 0; j < numY - 1; ++j) {
    previousY = currentY;
    currentY = Math.round(height - 1 - hrAlt[j + 1] * kh);
    const j0 = numX * clampIndex(j + 2, numY);
    const j1 = numX * clampIndex(j + 1, numY);
    const j2 = numX * clampIndex(j + 0, numY);
    const j3 = numX * clampIndex(j - 1, numY);
    let previousX = 0;
    let currentX = dx2;
    const deltaY = previousY - currentY;
    const invDeltaY = 1.0 / deltaY;

    for (let i = 0; i < numX + 1; ++i) {
      if (i == 0 && deltaY > 0) {
        const ry = 1.0 / deltaY;
        for (let l = 0; l < deltaY; l++) {
          heightLookup[--heightLookupIndex] = j;
          heightLookup[--heightLookupIndex] = Math.round(10000 * ry * l);
        }
      }
      const i0 = clampIndex(i - 2, numX);
      const i1 = clampIndex(i - 1, numX);
      const i2 = clampIndex(i + 0, numX);
      const i3 = clampIndex(i + 1, numX);
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
      const dx = currentX - previousX;
      const fx = 1.0 / dx;

      for (let y = 0; y < deltaY; ++y) {
        let offset = topLeft + y * width;
        for (let x = 0; x < dx; ++x) {
          const black = step(bicubicFiltering(buffer, fx * x, invDeltaY * y) * 160.0);
          clouds[offset++] = 255 - black;
        }
      }

      previousX = currentX;
      currentX += sliceWidth;

      currentX = Math.min(currentX, width);
    }
  }

  return { clouds, width, height };
}

function clampIndex(index: any, size: any) {
  return index < 0 ? 0 : index > size - 1 ? size - 1 : index;
}

function step(x: any) {
  return lookup[Math.floor(clampIndex(x, 160))];
}

function cubicInterpolate(y0: any, y1: any, y2: any, y3: any, m: any) {
  const a0 = -y0 * 0.5 + 3.0 * y1 * 0.5 - 3.0 * y2 * 0.5 + y3 * 0.5;
  const a1 = y0 - 5.0 * y1 * 0.5 + 2.0 * y2 - y3 * 0.5;
  const a2 = -y0 * 0.5 + y2 * 0.5;
  return a0 * m ** 3 + a1 * m ** 2 + a2 * m + y1;
}

function bicubicFiltering(m: any, s: any, t: any) {
  return cubicInterpolate(
    cubicInterpolate(m[0], m[1], m[2], m[3], s),
    cubicInterpolate(m[4], m[5], m[6], m[7], s),
    cubicInterpolate(m[8], m[9], m[10], m[11], s),
    cubicInterpolate(m[12], m[13], m[14], m[15], s),
    t,
  );
}

// Draw the clouds on a canvas.
// This function is useful for debugging.
export function cloudsToCanvas({ clouds, width, height, canvas }: any) {
  if (canvas == null) {
    canvas = document.createElement('canvas');
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
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
      imgData[dstOffset++] = color < 245 ? 255 : 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  ctx.drawImage(canvas, 0, 0, width, height);

  return canvas;
}
