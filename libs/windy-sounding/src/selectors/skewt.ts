import { createSelector } from 'reselect';

import * as math from '../util/math';
import {
  altiMetric,
  elevation,
  forecasts,
  formatAltitude,
  formatTemp,
  GRAPH_GAP_PX,
  GRAPH_WINDGRAM_WIDTH_PERCENT,
  graphHeight,
  timestamp,
  tMetric,
  width as totalWidth,
  zoom,
} from './sounding';

const windyUtils = W.utils;

export const width = (state: any) =>
  Math.floor(totalWidth(state) * (1 - GRAPH_WINDGRAM_WIDTH_PERCENT / 100) - GRAPH_GAP_PX);
export const pZoomMin = (state: any) => state.skewt.pMin;
export const pMax = (state: any) => state.skewt.pMax;

export const pMin = createSelector(pZoomMin, zoom, (pMin, zoom) => (zoom ? pMin : 150));

// Set of parameters at a given timestamp.
// Interpolate from the two nearest times.
export const params = createSelector(forecasts, timestamp, pMin, (forecasts, timestamp, pMin) => {
  if (!forecasts || forecasts.isLoading) {
    return null;
  }
  const { times, values } = forecasts;
  const next = times.findIndex((t: any) => t >= timestamp);
  if (next == -1) {
    return null;
  }
  const previous = Math.max(0, next - 1);

  let topLevelIndex = forecasts.levels.findIndex((p: any) => p <= pMin);
  if (topLevelIndex == -1) {
    topLevelIndex = forecasts.levels.length - 1;
  }
  const levels = forecasts.levels.slice(0, topLevelIndex + 1);

  const params = {};

  Object.getOwnPropertyNames(values[previous]).forEach((name) => {
    params[name] = math.linearInterpolate(
      times[previous],
      values[previous][name],
      times[next],
      values[next][name],
      timestamp,
    );
    params[name].splice(topLevelIndex + 1);
  });

  // @ts-expect-error TS(2339): Property 'level' does not exist on type '{}'.
  params.level = levels;

  // @ts-expect-error TS(2339): Property 'wind_u' does not exist on type '{}'.
  const wind = params.wind_u.map((u: any, index: any) => {
    // @ts-expect-error TS(2339): Property 'wind_v' does not exist on type '{}'.
    const v = params.wind_v[index];
    return windyUtils.wind2obj([u, v]);
  });

  // @ts-expect-error TS(2339): Property 'windSpeed' does not exist on type '{}'.
  params.windSpeed = wind.map((w: any) => w.wind);
  // @ts-expect-error TS(2339): Property 'windDir' does not exist on type '{}'.
  params.windDir = wind.map((w: any) => w.dir);

  return params;
});

export const tMax = createSelector(forecasts, (f) => f.tMax + 8);
export const tMin = createSelector(tMax, (tMax) => tMax - 60);

export const skew = createSelector(
  width,
  graphHeight,
  pMax,
  pMin,
  tMax,
  tMin,
  (width, height, pMax, pMin, tMax, tMin) =>
    (75 * (width / height) * (Math.log10(pMax) - Math.log10(pMin))) / (tMax - tMin),
);

export const tToPx = createSelector(width, tMax, tMin, (width, tMax, tMin) =>
  math.scaleLinear([tMin, tMax], [0, width]),
);

export const tAxisToPx = createSelector(width, tMax, tMin, formatTemp, (width, tMax, tMin, format) =>
  math.scaleLinear([tMin, tMax].map(format), [0, width]),
);

export const pToPx = createSelector(graphHeight, pMax, pMin, (height, pMax, pMin) =>
  math.scaleLog([pMax, pMin], [height, 0]),
);

export const pToGh = createSelector(params, (p) => math.scaleLog(p.level, p.gh));

export const pAxisToPx = createSelector(
  params,
  pToGh,
  graphHeight,
  pMin,
  formatAltitude,
  (params, pToGh, height, pMin, formatAltitude) =>
    math.scaleLinear([params.gh[0], pToGh(pMin)].map(formatAltitude), [height, 0]),
);

export const line = createSelector(tToPx, skew, graphHeight, pToPx, (tToPx, skew, height, pToPx) =>
  math.line(
    (v: any) => tToPx(v[0]) + skew * (height - pToPx(v[1])),
    (v: any) => pToPx(v[1]),
  ),
);

export const pSfc = createSelector(elevation, params, pToGh, (elevation, params, pToGh) => {
  const levels = params.level;
  return Math.min(pToGh.invert(elevation), levels[0]);
});

export const tSfc = createSelector(params, pSfc, (params, sfcPressure) => {
  const levels = params.level;
  const temp = params.temp;
  const pToTemp = math.scaleLog(levels, temp);
  return pToTemp(sfcPressure);
});

export const dewpointSfc = createSelector(params, pSfc, (params, sfcPressure) => {
  const levels = params.level;
  const dewpoint = params.dewpoint;
  const pToDp = math.scaleLog(levels, dewpoint);
  return pToDp(sfcPressure);
});

export const ghAxisStep = createSelector(altiMetric, (m) => (m === 'm' ? 1000 : 3000));

export const tAxisStep = createSelector(tMetric, (m) => (m === '°C' ? 10 : 20));
