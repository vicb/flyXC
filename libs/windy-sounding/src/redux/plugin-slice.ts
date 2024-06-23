import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { DataHash, Fav, LatLon, MeteogramDataPayload, WeatherDataPayload } from '@windy/interfaces';
import type { MeteogramLayers } from '@windy/types';

import * as atm from '../util/atmosphere';
import {
  type CloudCoverGenerator,
  computePeriodClouds,
  DEBUG_CLOUDS,
  debugCloudCanvas,
  debugCloudTimeCursor,
  getCloudCoverGenerator,
  type PeriodCloud,
} from '../util/clouds';
import { sampleAt, type Scale, scaleLog } from '../util/math';
import { getFavLabel } from '../util/utils';
import type { AppThunkAPI, RootState } from './store';

const windyStore = W.store;
const windyUtils = W.utils;
const windyFetch = W.fetch;
const windySubscription = W.subscription;
const windyProducts = W.products;
const windyMetrics = W.metrics;

// Cache stale windy data for 10 minutes.
// Data are stale when an update is expected.
const STALE_WINDY_DATA_CACHE_MIN = 10;

// Some models do not have the required parameters for soundings (i.e. surface only)
export const SUPPORTED_MODEL_PREFIXES = ['ecmwf', 'gfs', 'nam', 'icon', 'hrrr', 'ukv', 'arome'];
const DEFAULT_MODEL = 'ecmwf';

export type TempUnit = 'K' | '°C' | '°F';
export type AltitudeUnit = 'm' | 'ft';
export type SpeedUnit = 'km/h' | 'mph' | 'kt' | 'bft';
export type PressureUnit = 'mmHg' | 'inHg' | 'hPa';

export enum FetchStatus {
  Idle = 'idle',
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error',
  ErrorOutOfBounds = 'errorOutOfBounds',
}

// Those properties varies with the altitude level.
const levelProps = ['temp', 'dewpoint', 'gh', 'windU', 'windV', 'rh'] as const;
type LevelProp = (typeof levelProps)[number];
type LevelPropByTime = `${LevelProp}ByTime`;

// Those properties do not vary with altitude.
const sfcProps = ['rainMm', 'seaLevelPressure'] as const;
type SfcProps = (typeof sfcProps)[number];
type SfcPropsByTime = `${SfcProps}ByTime`;

type TimeValue = Record<LevelProp, number[]> & Record<SfcProps, number>;

export type PeriodValue = {
  maxTemp: number;
  minTemp: number;
  maxSeaLevelPressure: number;
  levels: number[];
  timesMs: number[];
} & Record<LevelPropByTime, number[][]> & // By time then by level
  // By time only
  Record<SfcPropsByTime, number[]>;

export type Forecast =
  | {
      forecastKey: string;
      modelName: string;
      location: LatLon;
      loadedMs: number;
    } & (
      | {
          fetchStatus: FetchStatus.Loading | FetchStatus.Error | FetchStatus.Idle | FetchStatus.ErrorOutOfBounds;
        }
      | {
          fetchStatus: FetchStatus.Loaded;
          meteogram: MeteogramDataPayload;
          weather: WeatherDataPayload<DataHash>;
          nextUpdateMs: number;
          updateMs: number;
        }
    );

export type ModelAndLocation = {
  modelName: string;
  location: LatLon;
};

type PluginState = {
  favorites: Fav[];
  // Default to true, i.e. PG mode, zoomed out mode is SkewT
  isZoomedIn: boolean;
  modelName: string;
  timeMs: number;
  width: number;
  height: number;
  location: LatLon;
  // The key is based on the model and location.
  windyDataKey: string;
  // Windy data by forecast key.
  windyDataCache: Record<string, Forecast>;
  tempUnit: TempUnit;
  altitudeUnit: AltitudeUnit;
  windSpeedUnit: SpeedUnit;
  pressureUnit: PressureUnit;
};

const initialState: PluginState = {
  favorites: [],
  isZoomedIn: true,
  width: 0,
  height: 0,
  location: { lat: 0, lon: 0 },
  windyDataKey: '',
  windyDataCache: {},
  modelName: windyStore.get('product'),
  timeMs: windyStore.get('timestamp'),
  tempUnit: windyStore.get('metric_temp'),
  altitudeUnit: windyStore.get('metric_altitude'),
  windSpeedUnit: windyStore.get('metric_wind'),
  pressureUnit: windyStore.get('metric_pressure'),
};

export const slice = createSlice({
  name: 'plugin',
  initialState,
  reducers: {
    setIsZoomedIn: (state, action: { payload: boolean }) => {
      state.isZoomedIn = action.payload;
    },
    setFavorites: (state, action: { payload: Fav[] }) => {
      action.payload.sort((favA, favB) => (getFavLabel(favA) > getFavLabel(favB) ? 1 : -1));
      state.favorites = action.payload;
    },
    setModelName: (state, action: { payload: string }) => {
      const modelName = SUPPORTED_MODEL_PREFIXES.some((prefix) => action.payload.startsWith(prefix))
        ? action.payload
        : DEFAULT_MODEL;
      state.modelName = modelName;
    },
    setTimeMs: (state, action: { payload: number }) => {
      state.timeMs = action.payload;
    },
    setWidth: (state, action: { payload: number }) => {
      state.width = action.payload;
    },
    setHeight: (state, action: { payload: number }) => {
      state.height = action.payload;
    },
    setLocation: (state, action: { payload: LatLon }) => {
      state.location = action.payload;
    },
    setTempUnit: (state, action: { payload: TempUnit }) => {
      state.tempUnit = action.payload;
    },
    setAltitudeUnit: (state, action: { payload: AltitudeUnit }) => {
      state.altitudeUnit = action.payload;
    },
    setWindSpeedUnit: (state, action: { payload: SpeedUnit }) => {
      state.windSpeedUnit = action.payload;
    },
    setPressureUnit: (state, action: { payload: PressureUnit }) => {
      state.pressureUnit = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchForecast.pending, (state, action) => {
      const key = windyDataKey(action.meta.arg);
      const { modelName, location } = action.meta.arg;
      state.windyDataCache[key] = {
        forecastKey: key,
        modelName,
        location,
        fetchStatus: FetchStatus.Loading,
        loadedMs: Date.now(),
      };
    });

    builder.addCase(fetchForecast.fulfilled, (state, action) => {
      const key = windyDataKey(action.meta.arg);
      state.windyDataKey = key;
      state.windyDataCache[key] = { ...state.windyDataCache[key], ...action.payload };
    });

    builder.addCase(fetchForecast.rejected, (state, action) => {
      const key = windyDataKey(action.meta.arg);
      const { modelName, location } = action.meta.arg;
      state.windyDataKey = key;
      state.windyDataCache[key] = {
        forecastKey: key,
        modelName,
        location,
        fetchStatus: action.error.name === 'OutOfBoundsError' ? FetchStatus.ErrorOutOfBounds : FetchStatus.Error,
        loadedMs: Date.now(),
      };
    });
  },
  selectors: {
    // Values
    selWidth: (state): number => state.width,
    selHeight: (state): number => state.height,
    selModelName: (state): string => state.modelName,
    selTimeMs: (state): number => state.timeMs,
    selIsZoomedIn: (state): boolean => state.isZoomedIn,
    selLocation: (state): LatLon => state.location,
    selFavorites: (state): Fav[] => state.favorites,
    selTempUnit: (state): TempUnit => state.tempUnit,
    selAltitudeUnit: (state): AltitudeUnit => state.altitudeUnit,
    selWindSpeedUnit: (state): SpeedUnit => state.windSpeedUnit,
    selPressureUnit: (state): PressureUnit => state.pressureUnit,

    // Computed
    selWindyDataUnsafe: (state): Forecast | undefined => {
      const key = state.windyDataKey;
      return isDataCached(state, key)
        ? (state.windyDataCache[key] as Forecast & { fetchStatus: FetchStatus.Loaded })
        : undefined;
    },
    selIsOutOfModelBounds: (state): boolean => {
      const windyData = slice.getSelectors().selWindyDataUnsafe(state);
      return windyData?.fetchStatus === FetchStatus.ErrorOutOfBounds;
    },

    selWindyDataIsLoading: (state): boolean => {
      const windyData = slice.getSelectors().selWindyDataUnsafe(state);
      return (
        windyData === undefined ||
        windyData.fetchStatus === FetchStatus.Loading ||
        windyData.fetchStatus === FetchStatus.Idle
      );
    },
    selWindyDataIsLoaded(state): boolean {
      const windyData = slice.getSelectors().selWindyDataUnsafe(state);
      return windyData !== undefined && windyData.fetchStatus === FetchStatus.Loaded;
    },
    selModelUpdateTimeMs(state): number {
      const windyData = selWindyData(state);
      return windyData.updateMs;
    },
    selModelNextUpdateTimeMs(state): number {
      const windyData = selWindyData(state);
      return windyData.nextUpdateMs;
    },
    selTzOffsetH(state): number {
      const windyData = selWindyData(state);
      return windyData.weather.celestial.TZoffset;
    },
    selSunriseMs(state): number {
      const windyData = selWindyData(state);
      return windyData.weather.celestial.sunriseTs;
    },
    selSunsetMs(state): number {
      const windyData = selWindyData(state);
      return windyData.weather.celestial.sunsetTs;
    },
    selDisplayParcel(state): boolean {
      const timeMs = slice.getSelectors().selTimeMs(state);
      const startMs = slice.getSelectors().selSunriseMs(state) + 2 * 3600 * 1000;
      const endMs = slice.getSelectors().selSunsetMs(state) - 3600 * 1000;
      const durationMs = endMs - startMs;
      return timeMs > startMs && (timeMs - startMs) % (24 * 3600 * 1000) < durationMs;
    },

    // Formatters
    selTempFormatter:
      (state): ((temp: number) => number) =>
      (temp: number) =>
        Math.round(windyMetrics.temp.conv[slice.getSelectors().selTempUnit(state)].conversion(temp)),
    selAltitudeFormatter:
      (state): ((altitude: number) => number) =>
      (altitude: number) =>
        Math.round(
          windyMetrics.altitude.conv[slice.getSelectors().selAltitudeUnit(state)].conversion(
            Math.round(altitude / 100) * 100,
          ),
        ),
    selPressureFormatter:
      (state): ((pressure: number) => number) =>
      (pressure: number) =>
        Math.round(windyMetrics.pressure.conv[slice.getSelectors().selPressureUnit(state)].conversion(pressure)),
    selWindSpeedFormatter:
      (state): ((windSpeed: number) => number) =>
      (windSpeed: number) =>
        Math.round(windyMetrics.wind.conv[slice.getSelectors().selWindSpeedUnit(state)].conversion(windSpeed)),
    // Levels in descending order
    selLevels: (state): number[] => {
      const windyData = selWindyData(state);
      return Object.keys(windyData.meteogram.data)
        .filter((key: string) => key.startsWith('temp-') && key.endsWith('h'))
        .map((key: string) => parseInt(key.slice(5, -1)))
        .sort((a: number, b: number) => b - a);
    },
    selMaxModelPressure: (state): number => {
      selWindyData(state);
      const levels = slice.getSelectors().selLevels(state);
      return Math.max(...levels);
    },
    selMinModelPressure: (state): number => {
      selWindyData(state);
      const levels = slice.getSelectors().selLevels(state);
      return Math.min(...levels);
    },
    selMinGraphPressure: (state): number => {
      selWindyData(state);
      const minPressure = slice.getSelectors().selMinModelPressure(state);
      const isZoomedIn = slice.getSelectors().selIsZoomedIn(state);
      return isZoomedIn ? 150 : minPressure;
    },
    selPeriodValues(state): PeriodValue {
      selWindyData(state);
      return computePeriodValues(state);
    },
    selMaxPeriodTemp(state): number {
      selWindyData(state);
      const periodValues = slice.getSelectors().selPeriodValues(state);
      return periodValues.maxTemp;
    },
    selMinPeriodTemp(state): number {
      selWindyData(state);
      const periodValues = slice.getSelectors().selPeriodValues(state);
      return periodValues.minTemp;
    },
    selPeriodClouds(state): PeriodCloud {
      const windyData = selWindyData(state);
      return computePeriodClouds(windyData.meteogram.data);
    },
    selGetCloudCoverGenerator(state): CloudCoverGenerator {
      const windyData = selWindyData(state);
      const timesMs = windyData.meteogram.data.hours;
      const timeMs = slice.getSelectors().selTimeMs(state);
      const { width, height, clouds } = slice.getSelectors().selPeriodClouds(state);
      const timesIndex = Math.max(
        1,
        timesMs.findIndex((ms) => ms > timeMs),
      );
      const startMs = timesMs[timesIndex - 1];
      const endMs = timesMs[timesIndex];
      const timeRatio = Math.max(0, Math.min(1, (endMs - timeMs) / (endMs - startMs)));
      const indexRatio = (timesIndex - timeRatio) / timesMs.length;
      const x = Math.round(Math.round((width - 1) * indexRatio));
      if (DEBUG_CLOUDS && debugCloudCanvas && debugCloudTimeCursor) {
        debugCloudTimeCursor.style.width = `${Math.round(debugCloudCanvas.width * indexRatio)}px`;
      }
      const cloudSliceAtMs: number[] = [];
      for (let y = height - 1; y >= 0; y--) {
        cloudSliceAtMs.push(clouds[x + y * width]);
      }
      return getCloudCoverGenerator(cloudSliceAtMs);
    },
    selMaxSeaLevelPressure(state): number {
      selWindyData(state);
      const periodValues = slice.getSelectors().selPeriodValues(state);
      return periodValues.maxSeaLevelPressure;
    },
    selAreValuesAvailableAtCurrentTime(state): boolean {
      const windyData = selWindyData(state);
      const maxTimeMs = Math.min(
        ...[windyData.meteogram.data.hours.at(-1), windyData.weather.data.ts.at(-1)].filter((v) => v !== undefined),
      );
      return slice.getSelectors().selTimeMs(state) <= maxTimeMs;
    },
    selValuesAtCurrentTime(state): TimeValue {
      const windyData = selWindyData(state);
      const periodValues = slice.getSelectors().selPeriodValues(state);
      const { timesMs } = periodValues;
      const timeMs = Math.max(
        slice.getSelectors().selTimeMs(state),
        windyData.meteogram.data.hours[0],
        windyData.weather.data.ts[0],
      );
      return {
        temp: sampleAt(timesMs, periodValues.tempByTime, timeMs),
        dewpoint: sampleAt(timesMs, periodValues.dewpointByTime, timeMs),
        gh: sampleAt(timesMs, periodValues.ghByTime, timeMs),
        rh: sampleAt(timesMs, periodValues.rhByTime, timeMs),
        windU: sampleAt(timesMs, periodValues.windUByTime, timeMs),
        windV: sampleAt(timesMs, periodValues.windVByTime, timeMs),
        rainMm: sampleAt(timesMs, periodValues.rainMmByTime, timeMs),
        seaLevelPressure: sampleAt(timesMs, periodValues.seaLevelPressureByTime, timeMs),
      };
    },
    selWindDetailsByLevel(state): { speed: number; direction: number }[] {
      selWindyData(state);
      const { windU, windV } = slice.getSelectors().selValuesAtCurrentTime(state);
      const details = [];
      for (let i = 0; i < windU.length; i++) {
        const { wind: speed, dir: direction } = windyUtils.wind2obj([windU[i], windV[i]]);
        details.push({ speed, direction });
      }
      return details;
    },
    selElevation(state): number {
      const windyData = selWindyData(state);
      const { weather, meteogram } = windyData;
      return meteogram.header.elevation ?? weather.header.elevation ?? meteogram.header.modelElevation;
    },
    selPressureToGhScale(state): Scale {
      selWindyData(state);
      const levels = slice.getSelectors().selLevels(state);
      const { gh, seaLevelPressure } = slice.getSelectors().selValuesAtCurrentTime(state);
      return atm.getPressureToGhScale(levels, gh, seaLevelPressure);
    },
    selParcel(state): atm.ParcelData {
      const timeValues = slice.getSelectors().selValuesAtCurrentTime(state);
      const periodValues = slice.getSelectors().selPeriodValues(state);
      const pressureToGhScale = slice.getSelectors().selPressureToGhScale(state);
      const elevation = slice.getSelectors().selElevation(state);
      const pressureToDewpointScale = scaleLog(periodValues.levels, timeValues.dewpoint);

      return atm.parcelTrajectory(
        periodValues.levels,
        timeValues.gh,
        timeValues.temp,
        3,
        elevation,
        pressureToDewpointScale(pressureToGhScale.invert(elevation)),
        40,
      );
    },
    selUpdateTime(state): ({ direction, stepIsDay }: { direction: number; stepIsDay: boolean }) => void {
      const tzOffset = slice.getSelectors().selTzOffsetH(state);
      return ({ direction, stepIsDay }: { direction: number; stepIsDay: boolean }) => {
        let timeMs = windyStore.get('timestamp');
        if (stepIsDay) {
          const date = new Date(timeMs);
          const utcHours = date.getUTCHours();
          date.setUTCMinutes(0);
          timeMs = date.getTime();
          // Jump to previous/next day at 13h.
          const refTime = (13 - tzOffset + 24) % 24;
          const deltaHours = (refTime - utcHours) * direction;
          if (deltaHours <= 0) {
            timeMs += direction * (24 + deltaHours) * 3600 * 1000;
          } else {
            timeMs += direction * deltaHours * 3600 * 1000;
          }
        } else {
          timeMs += direction * 3600 * 1000;
        }

        windyStore.set('timestamp', timeMs);
      };
    },
    selWheelEventHandler(state): (e: WheelEvent) => void {
      let nextWheelMove = 0;
      return (e: WheelEvent) => {
        const updateTime = slice.getSelectors().selUpdateTime(state);
        if (Date.now() > nextWheelMove) {
          const stepIsDay: boolean = e.shiftKey || e.ctrlKey;
          const direction: number = Math.sign(e.deltaY);
          updateTime({ direction, stepIsDay });
          nextWheelMove = Date.now() + (stepIsDay ? 800 : 20);
        }
        e.stopImmediatePropagation();
        e.preventDefault();
      };
    },
  },
});

/**
 * Throws when accessing data that are not loaded yet.
 *
 * @param state
 */
function selWindyData(state: PluginState): Forecast & { fetchStatus: FetchStatus.Loaded } {
  const windyData = slice.getSelectors().selWindyDataUnsafe(state);
  if (windyData === undefined || windyData.fetchStatus !== FetchStatus.Loaded) {
    throw new Error('Data not loaded');
  }
  return windyData;
}

class OutOfBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutOfBoundsError';
  }
}

export const fetchForecast = createAsyncThunk<Forecast, ModelAndLocation, { state: RootState }>(
  'plugin/fetchForecast',
  async (modelAndLocation: ModelAndLocation, api: { getState: () => RootState }) => {
    const key = windyDataKey(modelAndLocation);

    if (isDataCached(slice.selectSlice(api.getState()), key)) {
      return slice.selectSlice(api.getState()).windyDataCache[key];
    }

    const { modelName, location } = modelAndLocation;
    const [meteogram, forecast] = await Promise.allSettled([
      // extended is required to get fulml length forecast for pro windy users
      windyFetch.getMeteogramForecastData(modelName, { ...location, step: 1 }, { extended: 'true' }),
      windyFetch.getPointForecastData(modelName, { ...location }),
    ]);

    if (meteogram.status === 'rejected') {
      if (
        meteogram.reason.status == 400 &&
        JSON.parse(meteogram.reason.responseText).message === 'Out of model bounds'
      ) {
        throw new OutOfBoundsError(meteogram.reason.message);
      }
      throw new Error('Failed to fetch meteogram data');
    }

    if (forecast.status === 'rejected') {
      if (forecast.reason.status == 400 && JSON.parse(forecast.reason.responseText).message === 'Out of mode bounds') {
        throw new OutOfBoundsError(forecast.reason.message);
      }
      throw new Error('Failed to fetch forecast data');
    }

    const updateMs = forecast.value.data.header.updateTs;
    const product = windyProducts[modelName];
    const updateIntervalMin = windySubscription.hasAny()
      ? product.intervalPremium ?? product.interval
      : product.interval;

    return {
      forecastKey: key,
      modelName,
      location,
      loadedMs: Date.now(),
      updateMs,
      nextUpdateMs: updateMs + updateIntervalMin * 60 * 1000,
      fetchStatus: FetchStatus.Loaded,
      meteogram: meteogram.value.data,
      weather: forecast.value.data,
    };
  },
  {
    condition: (modelAndLocation, api: AppThunkAPI) => {
      // Prevent fetching again while loading.
      const key = windyDataKey(modelAndLocation);
      const data = slice.selectSlice(api.getState()).windyDataCache[key];
      return data?.fetchStatus != FetchStatus.Loading;
    },
  },
);

function windyDataKey(modelAndLocation: ModelAndLocation): string {
  return `${modelAndLocation.modelName}-${windyUtils.latLon2str(modelAndLocation.location)}`;
}

function isDataCached(state: PluginState, key: string) {
  const nowMs = Date.now();
  const forecast = state.windyDataCache[key];
  if (forecast == null) {
    return false;
  }

  if (forecast.fetchStatus === FetchStatus.ErrorOutOfBounds) {
    return true;
  }

  if (forecast.fetchStatus === FetchStatus.Loaded) {
    const requestMs = forecast.loadedMs;
    const dataAgeMin = (nowMs - requestMs) / (60 * 1000);
    return nowMs < forecast.nextUpdateMs || dataAgeMin < STALE_WINDY_DATA_CACHE_MIN;
  }

  return false;
}

function extractMeteogramParamByLevel(
  meteogram: MeteogramDataPayload,
  paramName: MeteogramLayers,
  levels: number[],
  tsIndex: number,
): number[] {
  return levels.map((level: number): number => {
    const valueByTs: number[] = (meteogram.data as Record<string, number[]>)[`${paramName}-${level}h`];
    const value = Array.isArray(valueByTs) ? valueByTs[tsIndex] : null;
    if (value == null) {
      if (paramName === 'gh') {
        // Approximate gh when not provided by the model
        return Math.round(atm.getElevation(level));
      }
      throw new Error('Unexpected null value');
    }
    return value;
  });
}

function computePeriodValues(state: PluginState): PeriodValue {
  const windyData = selWindyData(state);
  const levels: number[] = slice.getSelectors().selLevels(state);

  const timesMeteogramMs: number[] = windyData.meteogram.data.hours;
  const timeWeatherMs: number[] = windyData.weather.data.ts;

  let maxTemp: number = Number.MIN_VALUE;
  let minTemp: number = Number.MAX_VALUE;
  let maxSeaLevelPressure: number = Number.MIN_VALUE;

  const values: Record<LevelPropByTime, number[][]> & Record<SfcPropsByTime, number[]> = {
    dewpointByTime: [],
    ghByTime: [],
    rhByTime: [],
    tempByTime: [],
    windUByTime: [],
    windVByTime: [],
    rainMmByTime: [],
    seaLevelPressureByTime: [],
  };

  for (let tsIndex = 0; tsIndex < timesMeteogramMs.length; tsIndex++) {
    const timeMs = timesMeteogramMs[tsIndex];
    const tempByLevel = extractMeteogramParamByLevel(windyData.meteogram, 'temp', levels, tsIndex);
    maxTemp = Math.max(maxTemp, ...tempByLevel);
    minTemp = Math.min(minTemp, ...tempByLevel);
    const seaLevelPressure = sampleAt(timeWeatherMs, windyData.weather.data.pressure, timeMs) / 100;
    maxSeaLevelPressure = Math.max(maxSeaLevelPressure, seaLevelPressure);
    values.tempByTime.push(tempByLevel);
    values.dewpointByTime.push(extractMeteogramParamByLevel(windyData.meteogram, 'dewpoint', levels, tsIndex));
    values.ghByTime.push(extractMeteogramParamByLevel(windyData.meteogram, 'gh', levels, tsIndex));
    values.rhByTime.push(extractMeteogramParamByLevel(windyData.meteogram, 'rh', levels, tsIndex));
    values.windUByTime.push(extractMeteogramParamByLevel(windyData.meteogram, 'wind_u', levels, tsIndex));
    values.windVByTime.push(extractMeteogramParamByLevel(windyData.meteogram, 'wind_v', levels, tsIndex));
    values.rainMmByTime.push(sampleAt(timeWeatherMs, windyData.weather.data.mm, timeMs));
    values.seaLevelPressureByTime.push(Math.round(seaLevelPressure));
  }

  return {
    timesMs: timesMeteogramMs,
    levels,
    maxTemp,
    minTemp,
    maxSeaLevelPressure,
    ...values,
  };
}

export const {
  setIsZoomedIn: setIsZoomedIn,
  setFavorites,
  setModelName,
  setTimeMs,
  setWidth,
  setHeight,
  setLocation,
} = slice.actions;

export const { reducer } = slice;

export const selectors = slice.getSelectors((state: RootState) => state.plugin);
