import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import type { DataHash, LatLon, MeteogramDataPayload, WeatherDataPayload } from '@windy/interfaces';
import type { MeteogramLayers } from '@windy/types';

import type { ParcelData } from '../util/atmosphere';
import { getElevation, getPressureToGhScale, parcelTrajectory } from '../util/atmosphere';
import type { CloudCoverGenerator, PeriodCloud } from '../util/clouds';
import {
  computePeriodClouds,
  DEBUG_CLOUDS,
  debugCloudCanvas,
  debugCloudTimeCursor,
  getCloudCoverGenerator,
} from '../util/clouds';
import type { Scale } from '../util/math';
import { sampleAt, scaleLinear } from '../util/math';
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
});

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
      // Prevent fetching again while loading or when data is already cached.
      const { modelName, location } = modelAndLocation;
      const state = api.getState();
      const pluginStatus = pluginSlice.selStatus(state);
      const windyData = selMaybeLoadedWindyData(state, modelName, location);
      return (
        pluginStatus === pluginSlice.PluginStatus.Ready &&
        (windyData === undefined ||
          !(
            windyData.fetchStatus == FetchStatus.Loaded ||
            windyData.fetchStatus == FetchStatus.Loading ||
            windyData.fetchStatus === FetchStatus.ErrorOutOfBounds
          ))
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
function isWindyDataCached(state: ForecastState, key: string) {
  const forecast = state.data[key];
  if (forecast == null) {
    return false;
  }

  // Do not reload out of bounds locations.
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
        return Math.round(getElevation(level));
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

// Selectors
const selTimeMs = (state: RootState, modelName: string, location: LatLon, timeMs: number) => timeMs;
/**
 * Note: returned data could be loading, loaded, errored.
 *
 * @returns windy data or undefined.
 */
const selMaybeWindyData = (state: RootState, modelName: string, location: LatLon): Forecast | undefined =>
  state[slice.name].data[windyDataKey(modelName, location)];

const selMaybeLoadedWindyData = (state: RootState, modelName: string, location: LatLon): Forecast | undefined => {
  const key = windyDataKey(modelName, location);
  return isWindyDataCached(state[slice.name], key) ? state[slice.name].data[key] : undefined;
};

/**
 * Throws when accessing data that are not loaded yet.
 *
 * @param state
 */
export const selLoadedWindyDataOrThrow = (
  state: RootState,
  modelName: string,
  location: LatLon,
): Forecast & { fetchStatus: FetchStatus.Loaded } => {
  const windyData = selMaybeLoadedWindyData(state, modelName, location);
  if (windyData === undefined || windyData.fetchStatus !== FetchStatus.Loaded) {
    throw new Error('Data not loaded');
  }
  return windyData;
};

/**
 * Note: The data can be available but in error state.
 */
export const selIsWindyDataAvailable = (state: RootState, modelName: string, location: LatLon): boolean => {
  const windyData = selMaybeLoadedWindyData(state, modelName, location);
  return windyData !== undefined;
};

export const selFetchStatus = (state: RootState, modelName: string, location: LatLon): FetchStatus => {
  const windyData = selMaybeWindyData(state, modelName, location);
  return windyData === undefined ? FetchStatus.Error : windyData.fetchStatus;
};

export const selModelUpdateTimeMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.updateMs;
};

export const selModelNextUpdateTimeMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.nextUpdateMs;
};

export const selTzOffsetH = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.weather.celestial.TZoffset;
};

export const selSunriseMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.weather.celestial.sunriseTs;
};

export const selSunsetMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.weather.celestial.sunsetTs;
};

export const selDescendingLevels = createSelector(selLoadedWindyDataOrThrow, (windyData): number[] =>
  Object.keys(windyData.meteogram.data)
    .filter((key: string) => key.startsWith('temp-') && key.endsWith('h'))
    .map((key: string) => parseInt(key.slice(5, -1)))
    .sort((a: number, b: number) => b - a),
);

export const selMaxModelPressure = createSelector(
  selDescendingLevels,
  (descendingLevels): number => descendingLevels[0],
);

export const selMinModelPressure = createSelector(
  selDescendingLevels,
  (descendingLevels): number => descendingLevels.at(-1) ?? 150,
);

export const selPeriodValues = createSelector(
  selLoadedWindyDataOrThrow,
  selDescendingLevels,
  (windyData, levels): PeriodValue => computePeriodValues(windyData, levels),
);

export const selMaxPeriodTemp = createSelector(selPeriodValues, (periodValues): number => periodValues.maxTemp);

export const selMinPeriodTemp = createSelector(selPeriodValues, (periodValues): number => periodValues.minTemp);

export const selPeriodClouds = createSelector(
  selLoadedWindyDataOrThrow,
  (windyData): PeriodCloud => computePeriodClouds(windyData.meteogram.data),
);

export const selGetCloudCoverGenerator = createSelector(
  selLoadedWindyDataOrThrow,
  selPeriodClouds,
  selTimeMs,
  (windyData, periodClouds, timeMs): CloudCoverGenerator => {
    const timesMs = windyData.meteogram.data.hours;
    const { width, height, clouds } = periodClouds;
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
);

export const selMaxSeaLevelPressure = createSelector(
  selPeriodValues,
  (periodValues): number => periodValues.maxSeaLevelPressure,
);

export const selIsWindyDataAvailableAt = (
  state: RootState,
  modelName: string,
  location: LatLon,
  timeMs: number,
): boolean => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  const maxTimeMs = Math.min(
    ...[windyData.meteogram.data.hours.at(-1), windyData.weather.data.ts.at(-1)].filter((v) => v !== undefined),
  );
  return timeMs <= maxTimeMs;
};

export const selValuesAt = createSelector(
  selLoadedWindyDataOrThrow,
  selPeriodValues,
  selTimeMs,
  (windyData, periodValues, timeMs): TimeValue => {
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
);

export const selWindDetailsByLevel = createSelector(
  selValuesAt,
  ({ windU, windV }): { speed: number; direction: number }[] => {
    const details = [];
    for (let i = 0; i < windU.length; i++) {
      const { wind: speed, dir: direction } = windyUtils.wind2obj([windU[i], windV[i]]);
      details.push({ speed, direction });
    }
    return details;
  },
);

export const selElevation = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  const { weather, meteogram } = windyData;
  return meteogram.header.elevation ?? weather.header.elevation ?? meteogram.header.modelElevation;
};

export const selPressureToGhScale = createSelector(
  selDescendingLevels,
  selValuesAt,
  (levels, values): Scale => getPressureToGhScale(levels, values.gh, values.seaLevelPressure),
);

export const selDisplayParcel = createSelector(
  selSunriseMs,
  selSunsetMs,
  selTimeMs,
  (sunriseMs, sunsetMs, timeMs): boolean => {
    const startMs = sunriseMs + 2 * 3600 * 1000;
    const endMs = sunsetMs - 3600 * 1000;
    const durationMs = endMs - startMs;
    return timeMs > startMs && (timeMs - startMs) % (24 * 3600 * 1000) < durationMs;
  },
);

export const selParcel = createSelector(
  selValuesAt,
  selPeriodValues,
  selPressureToGhScale,
  selElevation,
  (timeValues, periodValues, pressureToGhScale, elevation): ParcelData => {
    const pressureToDewpointScale = scaleLinear(periodValues.levels, timeValues.dewpoint);
    return parcelTrajectory(
      periodValues.levels,
      timeValues.gh,
      timeValues.temp,
      3,
      elevation,
      pressureToDewpointScale(pressureToGhScale.invert(elevation)),
      40,
    );
  },
);

export const { reducer } = slice;
