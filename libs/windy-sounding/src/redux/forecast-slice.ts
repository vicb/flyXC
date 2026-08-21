import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import type { HttpPayload } from '@windy/client/http';
import type { LatLon } from '@windy/interfaces';
import type { AnyMeteogramLevels, DataHash2, SoundingDataHash2, WeatherDataPayload2 } from '@windy/node-forecast-v3';

import type { ParcelData } from '../util/atmosphere';
import {
  dewpoint,
  getElevation,
  getPressureToGhScale,
  parcelTrajectory,
  saturationVaporPressure,
} from '../util/atmosphere';
import type { Scale } from '../util/math';
import { lerpAngleDegree, sampleAt, scaleLinear } from '../util/math';
import { latLon2Str } from '../util/utils';
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
const _levelProps = ['temp', 'dewpoint', 'gh', 'wind', 'windDir', 'rh', 'cloud'] as const;
type LevelProp = (typeof _levelProps)[number];
type LevelPropByTime = `${LevelProp}ByTime`;

// Those properties do not vary with altitude.
const _sfcProps = ['rainMm', 'seaLevelPressure'] as const;
type SfcProps = (typeof _sfcProps)[number];
type SfcPropsByTime = `${SfcProps}ByTime`;

type TimeValue = Record<LevelProp, number[]> & Record<SfcProps, number>;

type ForecastType = WeatherDataPayload2<DataHash2>;

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
          forecast: ForecastType;
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

    let forecast: HttpPayload<ForecastType>;

    try {
      forecast = await windyFetch.getPointForecastData(
        modelName,
        { ...location, days: 15, step: 1 },
        { header: true, celestial: true, sounding: true },
      );
    } catch (err) {
      const error = err as { status: number; responseText: string };
      if (error.status === 400 && JSON.parse(error.responseText).message === 'Out of model bounds') {
        throw new OutOfBoundsError('Out of model bounds');
      }
      throw new Error('Failed to fetch forecast data');
    }

    const updateMs = new Date(forecast.data.header.update as string).getTime();
    const product = windyProducts[modelName];
    const updateIntervalMin = product
      ? (windySubscription.hasAny() ? product.intervalPremium ?? product.interval : product.interval) ?? 360
      : 360;

    return {
      forecastKey,
      modelName,
      location,
      loadedMs: Date.now(),
      updateMs,
      nextUpdateMs: updateMs + updateIntervalMin * 60 * 1000,
      fetchStatus: FetchStatus.Loaded,
      forecast: forecast.data,
    };
  },
  {
    condition: (modelAndLocation, api: AppThunkAPI) => {
      // Prevent fetching again while loading, when data is already cached, or when plugin is not ready.
      const { modelName, location } = modelAndLocation;
      // Ignore initial dummy coordinates (0, 0) before a real location is provided.
      if (location.lat === 0 && location.lon === 0) {
        return false;
      }
      const state = api.getState();
      if (pluginSlice.selStatus(state) !== pluginSlice.PluginStatus.Ready) {
        return false;
      }

      const key = windyDataKey(modelName, location);
      const forecast = state[slice.name].data[key];

      if (forecast) {
        if (forecast.fetchStatus === FetchStatus.Loading || forecast.fetchStatus === FetchStatus.ErrorOutOfBounds) {
          return false;
        }
        if (forecast.fetchStatus === FetchStatus.Loaded && isWindyDataCached(state[slice.name], key)) {
          return false;
        }
      }

      return true;
    },
  },
);

function windyDataKey(modelName: string, location: LatLon): string {
  return `${modelName}-${latLon2Str(location)}`;
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

/**
 * Extracts atmospheric values across pressure levels for a given parameter and time index from sounding data.
 *
 * Automatically computes dew point from relative humidity and temperature when direct dew point series are unavailable,
 * and approximates geopotential height (gh) from the barometric formula if omitted by the model.
 *
 * @param sounding - Sounding data payload.
 * @param paramName - Parameter to extract ('temp', 'dewpoint', 'gh', 'rh', 'wind', or 'windDir').
 * @param levels - Pressure levels in descending order (in hPa).
 * @param tsIndex - Timestamp index in the time series.
 * @returns Array of parameter values corresponding to each level.
 */
function extractSoundingParamByLevel(
  sounding: SoundingDataHash2,
  paramName: LevelProp,
  levels: number[],
  tsIndex: number,
): number[] {
  return levels.map((level: number): number => {
    const levelKey = `${level}h` as AnyMeteogramLevels;

    if (paramName === 'dewpoint') {
      const dew = sounding[`dewPoint-${levelKey}`]?.[tsIndex];
      if (dew != null) {
        return dew;
      }
      const temp = sounding[`temp-${levelKey}`]?.[tsIndex];
      const rh = sounding[`rh-${levelKey}`]?.[tsIndex];
      if (temp != null && rh != null) {
        return typeof windyUtils.computeDewPointKelvin === 'function'
          ? windyUtils.computeDewPointKelvin(rh, temp)
          : dewpoint(saturationVaporPressure(temp) * (rh / 100));
      }
    }

    let value: number | undefined;
    switch (paramName) {
      case 'temp':
        value = sounding[`temp-${levelKey}`]?.[tsIndex];
        break;
      case 'rh':
        value = sounding[`rh-${levelKey}`]?.[tsIndex];
        break;
      case 'gh':
        value = sounding[`gh-${levelKey}`]?.[tsIndex];
        break;
      case 'wind':
        value = sounding[`wind-${levelKey}`]?.[tsIndex];
        break;
      case 'windDir':
        value = sounding[`windDir-${levelKey}`]?.[tsIndex];
        break;
      case 'cloud':
        value = sounding[`cloud-${levelKey}`]?.[tsIndex] ?? 0;
        break;
    }

    if (value == null) {
      if (paramName === 'gh') {
        // Approximate gh when not provided by the model
        return Math.round(getElevation(level));
      }
      throw new Error(`Unexpected null value for ${paramName}-${levelKey}`);
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
  if (!windyData.forecast.sounding?.ts) {
    throw new Error('Invalid forecast data: No sounding timestamps found.');
  }

  const soundingData = windyData.forecast.sounding;
  const soundingTimeMs: number[] = soundingData.ts;

  let maxTemp: number = Number.MIN_VALUE;
  let minTemp: number = Number.MAX_VALUE;
  let maxSeaLevelPressure: number = Number.MIN_VALUE;

  const values: Record<LevelPropByTime, number[][]> & Record<SfcPropsByTime, number[]> = {
    dewpointByTime: [],
    ghByTime: [],
    rhByTime: [],
    tempByTime: [],
    windByTime: [],
    windDirByTime: [],
    cloudByTime: [],
    rainMmByTime: [],
    seaLevelPressureByTime: [],
  };

  for (let tsIndex = 0; tsIndex < soundingTimeMs.length; tsIndex++) {
    const timeMs = soundingTimeMs[tsIndex];
    const tempByLevel = extractSoundingParamByLevel(soundingData, 'temp', levels, tsIndex);
    maxTemp = Math.max(maxTemp, ...tempByLevel);
    minTemp = Math.min(minTemp, ...tempByLevel);
    const seaLevelPressure = sampleAt(soundingTimeMs, windyData.forecast.data.pressure, timeMs) / 100;
    maxSeaLevelPressure = Math.max(maxSeaLevelPressure, seaLevelPressure);
    values.tempByTime.push(tempByLevel);
    values.dewpointByTime.push(extractSoundingParamByLevel(soundingData, 'dewpoint', levels, tsIndex));
    values.ghByTime.push(extractSoundingParamByLevel(soundingData, 'gh', levels, tsIndex));
    values.rhByTime.push(extractSoundingParamByLevel(soundingData, 'rh', levels, tsIndex));
    values.windByTime.push(extractSoundingParamByLevel(soundingData, 'wind', levels, tsIndex));
    values.windDirByTime.push(extractSoundingParamByLevel(soundingData, 'windDir', levels, tsIndex));
    values.cloudByTime.push(extractSoundingParamByLevel(soundingData, 'cloud', levels, tsIndex));
    values.rainMmByTime.push(sampleAt(soundingTimeMs, windyData.forecast.data.precipAmount, timeMs));
    values.seaLevelPressureByTime.push(Math.round(seaLevelPressure));
  }

  return {
    timesMs: soundingTimeMs,
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
  return windyData.forecast.celestial.TZoffset;
};

export const selSunriseMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.forecast.celestial.sunriseTs;
};

export const selSunsetMs = (state: RootState, modelName: string, location: LatLon): number => {
  const windyData = selLoadedWindyDataOrThrow(state, modelName, location);
  return windyData.forecast.celestial.sunsetTs;
};

/**
 * Available pressure levels in the model in descending order in hPa (e.g. [1000, 950, 925, ...]).
 *
 * Note:
 * - `windyData.forecast.header.availableLevels` might contain levels not present on the sounding.
 * - In some high-resolution models (e.g. ICON-D2), near-surface pressure levels (like 975h or 1000h)
 *   can contain `null` entries when the level is subterranean (below ground due to terrain elevation
 *   or diurnal pressure drops). We only include levels that have complete, non-null data across all
 *   timestamps to avoid runtime errors during sounding calculations.
 */
export const selDescendingLevels = createSelector(selLoadedWindyDataOrThrow, (windyData): number[] => {
  const sounding = windyData.forecast.sounding;
  if (!sounding?.ts) {
    return [];
  }
  const numTimestamps = sounding.ts.length;
  return (
    Object.keys(sounding)
      .filter((key: string) => key.startsWith('temp-') && key.endsWith('h'))
      // Only keep levels with non-null values for all timestamps (filters out subterranean/partial levels)
      .filter((key: string) => {
        const values = (sounding as Record<string, unknown>)[key];
        return Array.isArray(values) && values.length >= numTimestamps && values.every((v) => v != null);
      })
      .map((key: string) => parseInt(key.slice(5, -1), 10))
      .sort((a: number, b: number) => b - a)
  );
});

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
  const windyData = selMaybeLoadedWindyData(state, modelName, location);
  if (!windyData || windyData.fetchStatus !== FetchStatus.Loaded || !windyData.forecast.sounding?.ts) {
    return false;
  }
  const maxTimeMs = Math.min(
    ...[windyData.forecast.sounding.ts.at(-1), windyData.forecast.data.ts.at(-1)].filter((v) => v !== undefined),
  );
  return timeMs <= maxTimeMs;
};

export const selValuesAt = createSelector(
  selLoadedWindyDataOrThrow,
  selPeriodValues,
  selTimeMs,
  (windyData, periodValues, timeMs): TimeValue => {
    const { timesMs } = periodValues;
    timeMs = Math.max(timeMs, windyData.forecast.sounding?.ts?.[0] ?? timesMs[0], windyData.forecast.data.ts[0]);
    return {
      temp: sampleAt(timesMs, periodValues.tempByTime, timeMs),
      dewpoint: sampleAt(timesMs, periodValues.dewpointByTime, timeMs),
      gh: sampleAt(timesMs, periodValues.ghByTime, timeMs),
      rh: sampleAt(timesMs, periodValues.rhByTime, timeMs),
      wind: sampleAt(timesMs, periodValues.windByTime, timeMs),
      windDir: sampleAt(timesMs, periodValues.windDirByTime, timeMs, lerpAngleDegree),
      cloud: sampleAt(timesMs, periodValues.cloudByTime, timeMs),
      rainMm: sampleAt(timesMs, periodValues.rainMmByTime, timeMs),
      seaLevelPressure: sampleAt(timesMs, periodValues.seaLevelPressureByTime, timeMs),
    };
  },
);

export const selElevation = (state: RootState, modelName: string, location: LatLon): number => {
  const { header } = selLoadedWindyDataOrThrow(state, modelName, location).forecast;
  return header.elevation ?? header.modelElevation ?? 0;
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
