import { createSelector } from 'reselect';

import { cloudsToCanvas, computeClouds, hrAlt } from '../util/clouds';
import * as math from '../util/math';

// Extra space at the bottom to draw the ticks.
export const GRAPH_BOTTOM_MARGIN_PX = 20;
export const GRAPH_WINDGRAM_WIDTH_PERCENT = 17;
// Gap between the skewT and the windgram.
export const GRAPH_GAP_PX = 5;

export const lat = (state: any) => state.plugin.lat;
export const lon = (state: any) => state.plugin.lon;
export const modelName = (state: any) => state.plugin.modelName;
export const timestamp = (state: any) => state.plugin.timestamp;
export const tMetric = (state: any) => state.metrics.temp;
export const pMetric = (state: any) => state.metrics.pressure;
export const altiMetric = (state: any) => state.metrics.altitude;
export const speedMetric = (state: any) => state.metrics.speed;
export const favorites = (state: any) => state.plugin.favorites;
// width * height of the graphs (skewT and windgram).
export const width = (state: any) => state.plugin.width;
export const height = (state: any) => state.plugin.height;
// excluding the bottom area use to draw the ticks.
export const graphHeight = (state: any) => state.plugin.height - GRAPH_BOTTOM_MARGIN_PX;
export const zoom = (state: any) => state.plugin.zoom;
export const yPointer = (state: any) => state.plugin.yPointer;

const windyStore = W.store;
const windyUtils = W.utils;
const windyMetrics = W.metrics;
const { map: windyMap } = W.map;
const windyRootScope = W.rootScope;

// Format parameters

export const formatTemp = createSelector(
  tMetric,
  (metric) => (v: any) => Math.round(windyMetrics.temp.conv[metric].conversion(v)),
);

export const formatPressure = createSelector(
  pMetric,
  (metric) => (v: any) => Math.round(windyMetrics.pressure.conv[metric].conversion(v)),
);

export const formatAltitude = createSelector(
  altiMetric,
  (metric) => (v: any) => Math.round(windyMetrics.altitude.conv[metric].conversion(v) / 100) * 100,
);

export const formatSpeed = createSelector(
  speedMetric,
  (metric) => (v: any) => Math.round(windyMetrics.wind.conv[metric].conversion(v)),
);

export const locationKey = createSelector(lat, lon, (lat, lon) => windyUtils.latLon2str({ lat, lon }));

// Forecasts
const models = (state: any) => state.models;

export const forecasts = createSelector(locationKey, models, modelName, (key, models, modelName) => {
  return (models[modelName] || {})[key];
});

const clouds = createSelector(forecasts, (forecasts) => computeClouds(forecasts.airData.data));

// Set to true to debug the cloud cover.
const debugClouds = false;
let canvas: any = null;

const cloudSlice = createSelector(clouds, timestamp, forecasts, (cloudsData, timestamp, forecasts) => {
  const { clouds, width, height } = cloudsData;
  const { times } = forecasts;
  const next = times.findIndex((t: any) => t >= timestamp);
  if (next == -1) {
    return null;
  }
  const prev = Math.max(0, next - 1);
  const stepX = width / times.length;
  const nextX = stepX / 2 + next * stepX;
  const prevX = stepX / 2 + prev * stepX;
  const x = Math.round(math.linearInterpolate(times[prev], prevX, times[next], nextX, timestamp));
  const cover = [];
  for (let y = 0; y < height; y++) {
    cover.push(clouds[x + y * width]);
  }
  // @ts-expect-error TS(2367): This condition will always return 'false' since th... Remove this comment to see the full error message
  if (debugClouds == true) {
    canvas = cloudsToCanvas({ canvas, clouds, width, height });
    document.body.append(canvas);
    canvas.style.position = 'fixed';
    canvas.style.top = '80px';
    canvas.style.right = '180px';
    canvas.style.backgroundColor = 'white';
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  return cover;
});

export const cloudCover = createSelector(cloudSlice, (slice) => {
  const { length } = slice;
  const levels = [1000, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 200, 150, 100];
  // lower indexes correspond to lower pressures
  const indexes = hrAlt.map((p) => (length - 1) * (1 - p / 100));
  const pToIndex = math.scaleLinear(levels, indexes);
  return (pFrom: any, pTo: any) => {
    const idxFrom = Math.round(pToIndex(pFrom));
    if (pTo == null) {
      return slice[idxFrom];
    }
    const idxTo = Math.round(pToIndex(pTo));
    const covers = slice.slice(idxTo, idxFrom).filter((v) => v > 0);
    return covers.length > 0 ? Math.min(...covers) : 0;
  };
});

export const isLoading = createSelector(forecasts, (f) => !f || f.isLoading === true);

export const tMax = createSelector(forecasts, (f) => f.tMax);

export const tMin = createSelector(forecasts, (f) => f.tMin);
export const pMin = createSelector(forecasts, (f) => f.pMax);
export const pMax = createSelector(forecasts, (f) => f.pMin);

export const elevation = createSelector(forecasts, ({ forecast, airData }) => {
  let elevation = forecast.header.elevation == null ? 0 : forecast.header.elevation;
  if (airData.header.elevation != null) {
    elevation = airData.header.elevation;
  }
  if (airData.header.modelElevation != null) {
    elevation = airData.header.modelElevation;
  }

  return elevation;
});

export const modelUpdated = createSelector(forecasts, (f) => f.forecast.header.updateTs);

export const modelNextUpdate = createSelector(forecasts, (f) => f.nextUpdate);

const tzOffset = createSelector(forecasts, (f) => f.forecast.celestial.TZoffset);

const sunrise = createSelector(forecasts, (f) => f.forecast.celestial.sunriseTs);

const sunset = createSelector(forecasts, (f) => f.forecast.celestial.sunsetTs);

export const isThermalHours = createSelector(sunrise, sunset, timestamp, (sunrise, sunset, timestamp) => {
  const startMillis = sunrise + 2 * 3600000;
  const stopMillis = sunset - 3600000;
  const durationMillis = stopMillis - startMillis;
  if (timestamp < startMillis || (timestamp - startMillis) % (24 * 3600000) > durationMillis) {
    return false;
  }
  return true;
});

export const centerMap = createSelector(width, (_width) => (lat: any, lon: any) => {
  const bounds = windyMap.getBounds();

  if (windyRootScope.isMobileOrTablet) {
    // TODO: improve
    const pluginContent = document.querySelector('#plugin-windy-plugin-sounding') as HTMLDivElement;
    if (!pluginContent) {
      console.error('plugin div not found');
      return;
    }
    // Portrait.
    const pluginHeight = pluginContent.offsetHeight;
    const mapHeight = windyMap.getSize().y;
    const deltaLat = bounds.getSouth() - bounds.getNorth();
    const centerLat = lat + ((deltaLat / mapHeight) * pluginHeight) / 2;
    windyMap.panTo({ lng: lon, lat: centerLat });
  } else {
    windyMap.panTo({ lng: lon, lat });
  }
});

// Returns a function used to update the time.
//
// - direction: +1 (forward) or -1 (backward),
// - changeDay: true to update to the next/previous day.
export const updateTime = createSelector(tzOffset, (tzOffset) => ({ direction, changeDay }: any) => {
  let ts = windyStore.get('timestamp');
  if (changeDay) {
    const d = new Date(ts);
    const h = d.getUTCHours();
    d.setUTCMinutes(0);
    ts = d.getTime();
    const refTime = (13 - tzOffset + 24) % 24;
    const dh = (refTime - h) * direction;
    if (dh <= 0) {
      ts += direction * (24 + dh) * 3600 * 1000;
    } else {
      ts += direction * dh * 3600 * 1000;
    }
  } else {
    ts += direction * 3600 * 1000;
  }

  windyStore.set('timestamp', ts);
});

// Updates the time on mouse wheel events.
let nextWheelMove = Date.now();
export const wheelHandler = createSelector(updateTime, (updateTime) => (e: any) => {
  if (Date.now() > nextWheelMove) {
    const changeDay = e.shiftKey || e.ctrlKey;
    const direction = Math.sign(e.deltaY);
    updateTime({ direction, changeDay });
    nextWheelMove = Date.now() + (changeDay ? 800 : 20);
  }
  e.stopPropagation();
  e.preventDefault();
});
