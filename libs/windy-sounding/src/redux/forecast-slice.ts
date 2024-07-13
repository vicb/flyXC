import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { DataHash, LatLon, MeteogramDataPayload, WeatherDataPayload } from '@windy/interfaces';
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
import * as pluginSlice from './plugin-slice';
import type { AppThunkAPI, RootState } from './store';

const windyUtils = W.utils;
const windyFetch = W.fetch;
const windySubscription = W.subscription;
const windyProducts = W.products;

// Cache stale windy data for 10 minutes.
// Data are stale when an update is expected.
const STALE_WINDY_DATA_CACHE_MIN = 10;

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

type ForecastState = {
  // Windy data by forecast key.
  data: Record<string, Forecast>;
};

const initialState: ForecastState = {
  data: {},
};

export const slice = createSlice({
  name: 'forecast',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchForecast.pending, (state: ForecastState, action) => {
      const { modelName, location } = action.meta.arg;
      const key = windyDataKey(modelName, location);
      state.data[key] = {
        forecastKey: key,
        modelName,
        location,
        fetchStatus: FetchStatus.Loading,
        loadedMs: Date.now(),
      };
    });

    builder.addCase(fetchForecast.fulfilled, (state: ForecastState, action) => {
      const { modelName, location } = action.meta.arg;
      const key = windyDataKey(modelName, location);
      state.data[key] = { ...state.data[key], ...action.payload };
    });

    builder.addCase(fetchForecast.rejected, (state: ForecastState, action) => {
      const { modelName, location } = action.meta.arg;
      const key = windyDataKey(modelName, location);
      state.data[key] = {
        forecastKey: key,
        modelName,
        location,
        fetchStatus: action.error.name === 'OutOfBoundsError' ? FetchStatus.ErrorOutOfBounds : FetchStatus.Error,
        loadedMs: Date.now(),
      };
    });
  },
  selectors: {
    /**
     * Note: returned data could be loading, loaded, errored.
     *
     * @returns windy data or undefined.
     */
    selMaybeWindyData: (state: ForecastState, modelName: string, location: LatLon): Forecast | undefined => {
      return state.data[windyDataKey(modelName, location)];
    },
    selMaybeLoadedWindyData: (state: ForecastState, modelName: string, location: LatLon): Forecast | undefined => {
      const key = windyDataKey(modelName, location);
      return isDataCached(state, key) ? state.data[key] : undefined;
    },
    selIsWindyDataAvailable: (state: ForecastState, modelName: string, location: LatLon): boolean => {
      const windyData = slice.getSelectors().selMaybeLoadedWindyData(state, modelName, location);
      return windyData !== undefined;
    },
    selFetchStatus: (state: ForecastState, modelName: string, location: LatLon): FetchStatus => {
      const windyData = slice.getSelectors().selMaybeWindyData(state, modelName, location);
      return windyData === undefined ? FetchStatus.Error : windyData.fetchStatus;
    },
    selModelUpdateTimeMs(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return windyData.updateMs;
    },
    selModelNextUpdateTimeMs(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return windyData.nextUpdateMs;
    },
    selTzOffsetH(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return windyData.weather.celestial.TZoffset;
    },
    selSunriseMs(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return windyData.weather.celestial.sunriseTs;
    },
    selSunsetMs(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return windyData.weather.celestial.sunsetTs;
    },
    // Levels in descending order
    selLevels: (state: ForecastState, modelName: string, location: LatLon): number[] => {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return Object.keys(windyData.meteogram.data)
        .filter((key: string) => key.startsWith('temp-') && key.endsWith('h'))
        .map((key: string) => parseInt(key.slice(5, -1)))
        .sort((a: number, b: number) => b - a);
    },
    selMaxModelPressure: (state: ForecastState, modelName: string, location: LatLon): number => {
      getWindyDataOrThrow(state, modelName, location);
      const levels = slice.getSelectors().selLevels(state, modelName, location);
      return Math.max(...levels);
    },
    selMinModelPressure: (state: ForecastState, modelName: string, location: LatLon): number => {
      getWindyDataOrThrow(state, modelName, location);
      const levels = slice.getSelectors().selLevels(state, modelName, location);
      return Math.min(...levels);
    },
    selPeriodValues(state: ForecastState, modelName: string, location: LatLon): PeriodValue {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      const levels = slice.getSelectors().selLevels(state, modelName, location);
      return computePeriodValues(windyData, levels);
    },
    selMaxPeriodTemp(state: ForecastState, modelName: string, location: LatLon): number {
      getWindyDataOrThrow(state, modelName, location);
      const periodValues = slice.getSelectors().selPeriodValues(state, modelName, location);
      return periodValues.maxTemp;
    },
    selMinPeriodTemp(state: ForecastState, modelName: string, location: LatLon): number {
      getWindyDataOrThrow(state, modelName, location);
      const periodValues = slice.getSelectors().selPeriodValues(state, modelName, location);
      return periodValues.minTemp;
    },
    selPeriodClouds(state: ForecastState, modelName: string, location: LatLon): PeriodCloud {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      return computePeriodClouds(windyData.meteogram.data);
    },
    selGetCloudCoverGenerator(state: ForecastState, modelName: string, location: LatLon, timeMs): CloudCoverGenerator {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      const timesMs = windyData.meteogram.data.hours;
      const { width, height, clouds } = slice.getSelectors().selPeriodClouds(state, modelName, location);
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
    selMaxSeaLevelPressure(state: ForecastState, modelName: string, location: LatLon): number {
      getWindyDataOrThrow(state, modelName, location);
      const periodValues = slice.getSelectors().selPeriodValues(state, modelName, location);
      return periodValues.maxSeaLevelPressure;
    },
    selIsWindyDataAvailableAt(state: ForecastState, modelName: string, location: LatLon, timeMs: number): boolean {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      const maxTimeMs = Math.min(
        ...[windyData.meteogram.data.hours.at(-1), windyData.weather.data.ts.at(-1)].filter((v) => v !== undefined),
      );
      return timeMs <= maxTimeMs;
    },
    selValuesAt(state: ForecastState, modelName: string, location: LatLon, timeMs: number): TimeValue {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      const periodValues = slice.getSelectors().selPeriodValues(state, modelName, location);
      const { timesMs } = periodValues;
      timeMs = Math.max(timeMs, windyData.meteogram.data.hours[0], windyData.weather.data.ts[0]);
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
    selWindDetailsByLevel(
      state,
      modelName: string,
      location: LatLon,
      timeMs: number,
    ): { speed: number; direction: number }[] {
      getWindyDataOrThrow(state, modelName, location);
      const { windU, windV } = slice.getSelectors().selValuesAt(state, modelName, location, timeMs);
      const details = [];
      for (let i = 0; i < windU.length; i++) {
        const { wind: speed, dir: direction } = windyUtils.wind2obj([windU[i], windV[i]]);
        details.push({ speed, direction });
      }
      return details;
    },
    selElevation(state: ForecastState, modelName: string, location: LatLon): number {
      const windyData = getWindyDataOrThrow(state, modelName, location);
      const { weather, meteogram } = windyData;
      return meteogram.header.elevation ?? weather.header.elevation ?? meteogram.header.modelElevation;
    },
    selPressureToGhScale(state: ForecastState, modelName: string, location: LatLon, timeMs: number): Scale {
      getWindyDataOrThrow(state, modelName, location);
      const levels = slice.getSelectors().selLevels(state, modelName, location);
      const { gh, seaLevelPressure } = slice.getSelectors().selValuesAt(state, modelName, location, timeMs);
      return atm.getPressureToGhScale(levels, gh, seaLevelPressure);
    },
    selDisplayParcel(state: ForecastState, modelName: string, location: LatLon, timeMs: number): boolean {
      const startMs = slice.getSelectors().selSunriseMs(state, modelName, location) + 2 * 3600 * 1000;
      const endMs = slice.getSelectors().selSunsetMs(state, modelName, location) - 3600 * 1000;
      const durationMs = endMs - startMs;
      return timeMs > startMs && (timeMs - startMs) % (24 * 3600 * 1000) < durationMs;
    },
    selParcel(state: ForecastState, modelName: string, location: LatLon, timeMs: number): atm.ParcelData {
      const timeValues = slice.getSelectors().selValuesAt(state, modelName, location, timeMs);
      const periodValues = slice.getSelectors().selPeriodValues(state, modelName, location);
      const pressureToGhScale = slice.getSelectors().selPressureToGhScale(state, modelName, location, timeMs);
      const elevation = slice.getSelectors().selElevation(state, modelName, location);
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
  },
});

/**
 * Throws when accessing data that are not loaded yet.
 *
 * @param state
 */
function getWindyDataOrThrow(
  state: ForecastState,
  modelName: string,
  location: LatLon,
): Forecast & { fetchStatus: FetchStatus.Loaded } {
  const windyData = slice.getSelectors().selMaybeLoadedWindyData(state, modelName, location);
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
  'forecast/fetch',
  async (modelAndLocation: ModelAndLocation) => {
    const { modelName, location } = modelAndLocation;
    const forecastKey = windyDataKey(modelName, location);
    const [meteogram, forecast] = await Promise.allSettled([
      // extended is required to get full length forecast for pro windy users
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
      forecastKey,
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
      const { modelName, location } = modelAndLocation;
      const state = api.getState();
      const pluginStatus = pluginSlice.selStatus(state);
      const windyData = slice.selectors.selMaybeLoadedWindyData(state, modelName, location);
      return (
        pluginStatus === pluginSlice.PluginStatus.Ready &&
        (windyData === undefined ||
          !(windyData.fetchStatus == FetchStatus.Loading || windyData.fetchStatus === FetchStatus.ErrorOutOfBounds))
      );
    },
  },
);

function windyDataKey(modelName: string, location: LatLon): string {
  return `${modelName}-${windyUtils.latLon2str(location)}`;
}

/**
 * Checks if the data for a specific key is cached and up-to-date.
 *
 * Note that data are still cached when they are out of bounds.
 *
 * @param state - The state object containing forecast data.
 * @param key - The key to identify the forecast data.
 * */
function isDataCached(state: ForecastState, key: string) {
  const forecast = state.data[key];
  if (forecast == null) {
    return false;
  }

  if (forecast.fetchStatus === FetchStatus.ErrorOutOfBounds) {
    return true;
  }

  if (forecast.fetchStatus === FetchStatus.Loaded) {
    const nowMs = Date.now();
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

function computePeriodValues(
  windyData: Forecast & {
    fetchStatus: FetchStatus.Loaded;
  },
  levels: number[],
): PeriodValue {
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

export const { reducer } = slice;
