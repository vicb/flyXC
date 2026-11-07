import {
  fetchForecast,
  FetchStatus,
  type Forecast,
  getSoundingTimesMs,
  isWindyDataCached,
  selCloudDescendingLevels,
  selGhDescendingLevels,
  selIsWindyDataAvailable,
  selIsWindyDataAvailableAt,
  selLoadedWindyDataOrThrow,
  selMaybeLoadedWindyData,
  selPeriodValues,
  selSoundingTimesMs,
  selTempDescendingLevels,
  selValuesAt,
  selWindDescendingLevels,
  slice,
  STALE_WINDY_DATA_CACHE_MIN,
  windyDataKey,
} from './forecast-slice';
import type { RootState } from './store';

describe('forecast-slice', () => {
  const modelName = 'ecmwf';
  const location = { lat: 45.1, lon: 6.2 };
  const key = windyDataKey(modelName, location);

  function createMockForecast(overrides: Partial<Forecast> = {}): Forecast {
    return {
      forecastKey: key,
      modelName,
      location,
      loadedMs: 1_000_000,
      fetchStatus: FetchStatus.Loaded,
      nextUpdateMs: 2_000_000,
      updateMs: 500_000,
      forecast: {
        header: {
          update: new Date(500_000).toISOString(),
          model: 'ecmwf',
          refTime: '2026-09-16T12:00:00Z',
        },
        data: {
          ts: [1_000_000, 2_000_000, 3_000_000],
          pressure: [101325, 101200, 101100],
          precipAmount: [0, 0, 0],
        },
        celestial: {
          TZoffset: 2,
          sunriseTs: 1_020_000,
          sunsetTs: 1_080_000,
        },
        sounding: {
          ts: [1_000_000, 2_000_000, 3_000_000],
          'temp-1000h': [290, 291, 292],
          'temp-850h': [280, 281, 282],
        },
      },
      ...overrides,
    } as Forecast;
  }

  function createMockState(forecast?: Forecast): RootState {
    return {
      forecast: {
        data: forecast ? { [key]: forecast } : {},
      },
      plugin: {
        status: 'ready',
        modelName,
        location,
        timeMs: 1_000_000,
      },
    } as unknown as RootState;
  }

  describe('isWindyDataCached', () => {
    it('should return false if forecast does not exist', () => {
      const state = { data: {} };
      expect(isWindyDataCached(state, key)).toBe(false);
    });

    it('should return true for ErrorOutOfBounds', () => {
      const state = {
        data: {
          [key]: {
            forecastKey: key,
            modelName,
            location,
            loadedMs: Date.now(),
            fetchStatus: FetchStatus.ErrorOutOfBounds,
          },
        },
      };
      expect(isWindyDataCached(state, key)).toBe(true);
    });

    it('should return true when nowMs < nextUpdateMs', () => {
      const now = 1_500_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const forecast = createMockForecast({
        loadedMs: 1_000_000,
        nextUpdateMs: 2_000_000,
      });
      const state = { data: { [key]: forecast } };

      expect(isWindyDataCached(state, key)).toBe(true);
      vi.restoreAllMocks();
    });

    it('should return true when nextUpdateMs passed but data is within STALE_WINDY_DATA_CACHE_MIN', () => {
      const loadedMs = 1_000_000;
      const nextUpdateMs = 1_100_000;
      // 5 minutes after loadedMs (less than 10 min)
      const now = loadedMs + 5 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const forecast = createMockForecast({ loadedMs, nextUpdateMs });
      const state = { data: { [key]: forecast } };

      expect(isWindyDataCached(state, key)).toBe(true);
      vi.restoreAllMocks();
    });

    it('should return false when nextUpdateMs passed AND dataAge >= STALE_WINDY_DATA_CACHE_MIN', () => {
      const loadedMs = 1_000_000;
      const nextUpdateMs = 1_100_000;
      // 15 minutes after loadedMs (more than 10 min)
      const now = loadedMs + (STALE_WINDY_DATA_CACHE_MIN + 5) * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const forecast = createMockForecast({ loadedMs, nextUpdateMs });
      const state = { data: { [key]: forecast } };

      expect(isWindyDataCached(state, key)).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('loaded data availability when stale', () => {
    it('should keep loaded forecast available in selMaybeLoadedWindyData even when cache is expired', () => {
      const loadedMs = 1_000_000;
      const nextUpdateMs = 1_100_000;
      // 3 hours later, cache is definitely stale
      const now = loadedMs + 3 * 3600 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const forecast = createMockForecast({ loadedMs, nextUpdateMs });
      const state = createMockState(forecast);

      // Verify that cache is indeed considered stale
      expect(isWindyDataCached(state.forecast, key)).toBe(false);

      // But selectors must still return the loaded data
      const loaded = selMaybeLoadedWindyData(state, modelName, location);
      expect(loaded).toBeDefined();
      expect(loaded?.fetchStatus).toBe(FetchStatus.Loaded);

      expect(selIsWindyDataAvailable(state, modelName, location)).toBe(true);
      expect(selLoadedWindyDataOrThrow(state, modelName, location)).toEqual(forecast);
      expect(selIsWindyDataAvailableAt(state, modelName, location, 2_000_000)).toBe(true);

      vi.restoreAllMocks();
    });

    it('should return false for selIsWindyDataAvailable when data is loading or errored', () => {
      const loadingForecast: Forecast = {
        forecastKey: key,
        modelName,
        location,
        loadedMs: Date.now(),
        fetchStatus: FetchStatus.Loading,
      };
      const state = createMockState(loadingForecast);

      expect(selMaybeLoadedWindyData(state, modelName, location)).toBeUndefined();
      expect(selIsWindyDataAvailable(state, modelName, location)).toBe(false);
      expect(() => selLoadedWindyDataOrThrow(state, modelName, location)).toThrow('Data not loaded');
    });
  });

  describe('extraReducers', () => {
    it('should set fetchStatus to Loading on fetchForecast.pending', () => {
      const existingForecast = createMockForecast();
      const initialState = {
        data: { [key]: existingForecast },
      };

      const nextState = slice.reducer(initialState, {
        type: 'forecast/fetch/pending',
        meta: { arg: { modelName, location } },
      });

      expect(nextState.data[key].fetchStatus).toBe(FetchStatus.Loading);
    });

    it('should set fetchStatus to Error on fetchForecast.rejected', () => {
      const initialState = {
        data: { [key]: createMockForecast() },
      };

      const nextState = slice.reducer(initialState, {
        type: 'forecast/fetch/rejected',
        meta: { arg: { modelName, location } },
        error: new Error('Network error'),
      });

      expect(nextState.data[key].fetchStatus).toBe(FetchStatus.Error);
    });

    it('should update forecast and set fetchStatus to Loaded on fulfilled', () => {
      const initialState = {
        data: {
          [key]: {
            forecastKey: key,
            modelName,
            location,
            loadedMs: Date.now(),
            fetchStatus: FetchStatus.Loading,
          },
        },
      };

      const updatedPayload = {
        updateMs: 900_000,
        nextUpdateMs: 3_000_000,
        loadedMs: 1_500_000,
        fetchStatus: FetchStatus.Loaded,
      };

      const nextState = slice.reducer(initialState, {
        type: 'forecast/fetch/fulfilled',
        meta: { arg: { modelName, location } },
        payload: updatedPayload,
      });

      expect(nextState.data[key].fetchStatus).toBe(FetchStatus.Loaded);
      expect((nextState.data[key] as any).updateMs).toBe(900_000);
    });
  });

  describe('fetchForecast condition', () => {
    it('should skip fetching if location is dummy (0, 0)', async () => {
      const dispatch = vi.fn();
      const getState = () => createMockState();
      const action = await fetchForecast({ modelName, location: { lat: 0, lon: 0 } })(dispatch, getState, undefined);

      expect(action.meta.requestStatus).toBe('rejected');
      expect((action.meta as any).condition).toBe(true);
    });

    it('should skip fetching if already Loading', async () => {
      const dispatch = vi.fn();
      const forecast: Forecast = {
        forecastKey: key,
        modelName,
        location,
        loadedMs: Date.now(),
        fetchStatus: FetchStatus.Loading,
      };
      const getState = () => createMockState(forecast);

      const action = await fetchForecast({ modelName, location })(dispatch, getState, undefined);

      expect(action.meta.requestStatus).toBe('rejected');
      expect((action.meta as any).condition).toBe(true);
    });

    it('should skip fetching if forecast is fresh in cache', async () => {
      const dispatch = vi.fn();
      const forecast = createMockForecast({
        loadedMs: 1_000_000,
        nextUpdateMs: 2_000_000,
      });
      vi.spyOn(Date, 'now').mockReturnValue(1_500_000);
      const getState = () => createMockState(forecast);

      const action = await fetchForecast({ modelName, location })(dispatch, getState, undefined);

      expect(action.meta.requestStatus).toBe('rejected');
      expect((action.meta as any).condition).toBe(true);
      vi.restoreAllMocks();
    });

    it('should proceed with fetching if loaded data is stale/expired', async () => {
      const dispatch = vi.fn();
      const forecast = createMockForecast({
        loadedMs: 1_000_000,
        nextUpdateMs: 1_100_000,
      });
      // 2 hours later, cache is stale
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 2 * 3600 * 1000);
      const getState = () => createMockState(forecast);

      (globalThis as any).W.fetch.getPointForecastData.mockResolvedValueOnce({
        data: forecast.forecast,
      });

      const action = await fetchForecast({ modelName, location })(dispatch, getState, undefined);

      expect(action.meta.requestStatus).toBe('fulfilled');
      vi.restoreAllMocks();
    });
  });

  describe('dewpoint extraction in selPeriodValues', () => {
    const baseSounding = {
      ts: [1_000_000],
      'temp-1000h': [290],
      'rh-1000h': [70],
      'wind-1000h': [5],
      'windDir-1000h': [180],
      'cloud-1000h': [20],
    };

    it('extracts dew point when formatted as lowercase dewpoint-<level>', () => {
      const forecast = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          sounding: {
            ...baseSounding,
            'dewpoint-1000h': [284],
          },
        } as any,
      });
      const state = createMockState(forecast);
      const periodValues = selPeriodValues(state, modelName, location);
      expect(periodValues.dewpointByTime).toEqual([[284]]);
    });

    it('extracts dew point when formatted as camelCase dewPoint-<level>', () => {
      const forecast = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          sounding: {
            ...baseSounding,
            'dewPoint-1000h': [285],
          },
        } as any,
      });
      const state = createMockState(forecast);
      const periodValues = selPeriodValues(state, modelName, location);
      expect(periodValues.dewpointByTime).toEqual([[285]]);
    });

    it('falls back to computeDewPointKelvin when neither is present', () => {
      (globalThis as any).W.utils.computeDewPointKelvin.mockReturnValueOnce(283);
      const forecast = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          sounding: {
            ...baseSounding,
          },
        } as any,
      });
      const state = createMockState(forecast);
      const periodValues = selPeriodValues(state, modelName, location);
      expect((globalThis as any).W.utils.computeDewPointKelvin).toHaveBeenCalledWith(70, 290);
      expect(periodValues.dewpointByTime).toEqual([[283]]);
    });
  });

  describe('mismatched upper-air vs surface horizon (e.g. mblue)', () => {
    const ts = [1000, 2000, 3000, 4000, 5000];
    const upperAirTs = [1000, 2000];

    const soundingWithShortUpperAir = {
      ts,
      'temp-surface': [290, 291, 292, 293, 294],
      'temp-1000h': [289, 290],
      'temp-850h': [280, 281],
      'rh-1000h': [70, 75],
      'rh-850h': [60, 65],
      'dewpoint-1000h': [284, 285],
      'dewpoint-850h': [275, 276],
      'gh-850h': [1500, 1510],
      'gh-750h': [2500, 2510],
      'wind-925h': [10, 12],
      'wind-700h': [15, 18],
      'windDir-925h': [180, 190],
      'windDir-700h': [200, 210],
      'cloud-1000h': [10, 20],
      'cloud-900h': [30, 40],
    };

    it('getSoundingTimesMs slices timestamps to upper-air horizon', () => {
      expect(getSoundingTimesMs(soundingWithShortUpperAir as any)).toEqual(upperAirTs);
    });

    it('selIsWindyDataAvailableAt restricts availability to upper-air horizon', () => {
      const forecast = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          data: {
            ts,
            pressure: [101325, 101200, 101100, 101000, 100900],
            precipAmount: [0, 2, 4, 6, 8],
          },
          sounding: soundingWithShortUpperAir,
        } as any,
      });
      const state = createMockState(forecast);

      // Within upper-air range
      expect(selIsWindyDataAvailableAt(state, modelName, location, 1000)).toBe(true);
      expect(selIsWindyDataAvailableAt(state, modelName, location, 2000)).toBe(true);

      // Past upper-air horizon, even though surface data exists
      expect(selIsWindyDataAvailableAt(state, modelName, location, 3000)).toBe(false);
      expect(selIsWindyDataAvailableAt(state, modelName, location, 5000)).toBe(false);
    });

    it('extracts decoupled levels per parameter family', () => {
      const forecast = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          data: {
            ts,
            pressure: [101325, 101200, 101100, 101000, 100900],
            precipAmount: [0, 2, 4, 6, 8],
          },
          sounding: soundingWithShortUpperAir,
        } as any,
      });
      const state = createMockState(forecast);

      expect(selSoundingTimesMs(state, modelName, location)).toEqual(upperAirTs);
      expect(selTempDescendingLevels(state, modelName, location)).toEqual([1000, 850]);
      expect(selWindDescendingLevels(state, modelName, location)).toEqual([925, 700]);
      expect(selGhDescendingLevels(state, modelName, location)).toEqual([850, 750]);
      expect(selCloudDescendingLevels(state, modelName, location)).toEqual([1000, 900]);

      const periodValues = selPeriodValues(state, modelName, location);
      expect(periodValues.timesMs).toEqual(upperAirTs);
      expect(periodValues.tempLevels).toEqual([1000, 850]);
      expect(periodValues.windLevels).toEqual([925, 700]);
      expect(periodValues.ghLevels).toEqual([850, 750]);
      expect(periodValues.cloudLevels).toEqual([1000, 900]);

      // Check extracted values align with their specific level definitions
      expect(periodValues.tempByTime).toEqual([
        [289, 280],
        [290, 281],
      ]);
      expect(periodValues.windByTime).toEqual([
        [10, 15],
        [12, 18],
      ]);
      expect(periodValues.windDirByTime).toEqual([
        [180, 200],
        [190, 210],
      ]);
      expect(periodValues.ghByTime).toEqual([
        [1500, 2500],
        [1510, 2510],
      ]);
      expect(periodValues.cloudByTime).toEqual([
        [10, 30],
        [20, 40],
      ]);

      // Verify selValuesAt samples rainMm correctly against timesMs (interpolated between 0 and 2 at 1500)
      const timeValues = selValuesAt(state, modelName, location, 1500);
      expect(timeValues.rainMm).toBe(1);
    });

    it('selWindDescendingLevels returns only levels with both speed and direction and does not fallback to temp', () => {
      const forecastWithPartialWind = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          sounding: {
            ts: [1000],
            'temp-1000h': [290],
            'rh-1000h': [70],
            'wind-1000h': [10], // speed without direction
            'wind-850h': [15],
            'windDir-850h': [180], // speed and direction
          },
        } as any,
      });
      const stateWithPartial = createMockState(forecastWithPartialWind);
      expect(selWindDescendingLevels(stateWithPartial, modelName, location)).toEqual([850]);

      const forecastWithNoWind = createMockForecast({
        forecast: {
          ...createMockForecast().forecast,
          sounding: {
            ts: [1000],
            'temp-1000h': [290],
            'rh-1000h': [70],
          },
        } as any,
      });
      const stateNoWind = createMockState(forecastWithNoWind);
      expect(selWindDescendingLevels(stateNoWind, modelName, location)).toEqual([]);
    });
  });
});
