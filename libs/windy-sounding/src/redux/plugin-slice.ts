import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import type { Fav } from '@windy/favs';
import type { LatLon } from '@windy/interfaces';

import { getFavLabel, getSupportedModelName, latLon2Str } from '../util/utils';
import type { RootState } from './store';

const windyStore = W.store;

export enum PluginStatus {
  Idle = 'idle',
  Booting = 'booting',
  Ready = 'ready',
}

type PluginState = {
  favorites: Fav[];
  // Default to true, i.e. PG mode, zoomed out mode is SkewT
  isZoomedIn: boolean;
  modelName: string;
  timeMs: number;
  width: number;
  height: number;
  location: LatLon;
  locationName: string | null;
  status: PluginStatus;
};

const initialState: PluginState = {
  favorites: [],
  isZoomedIn: true,
  width: 100,
  height: 100,
  location: { lat: 0, lon: 0 },
  locationName: null,
  modelName: 'ecmwf',
  timeMs: windyStore.get('timestamp'),
  status: PluginStatus.Idle,
};

/**
 * Asynchronously fetches a reverse-geocoded place name from Windy for non-favorite locations.
 * Uses a 200ms debounce delay cancellable via AbortSignal to avoid flooding requests during map dragging.
 */
export const fetchLocationName = createAsyncThunk<string | null, LatLon, { state: RootState }>(
  'plugin/fetchLocationName',
  async (location: LatLon, { signal }) => {
    // Debounce delay cancellable via AbortSignal
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 200);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

    const lat = Number(location.lat);
    const lon = Number(location.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }

    const result = await W.reverseName.get({ lat, lon }, 10);

    if (signal.aborted) {
      return null;
    }

    return result?.nameValid ? result.name.trim() : W.geolocation.getFallbackName(lat, lon);
  },
  {
    condition: (location, { getState }) => {
      const state = getState();
      const matchingFavorite = selMatchingFavorite(state);
      // Skip lookup if already at a favorite or at initial dummy coordinates.
      return !matchingFavorite && (location.lat !== 0 || location.lon !== 0);
    },
  },
);

export const slice = createSlice({
  name: 'plugin',
  initialState,
  reducers: {
    setIsZoomedIn: (state, action: { payload: boolean }) => {
      state.isZoomedIn = action.payload;
    },
    setFavorites: (state, action: { payload: Fav[] }) => {
      const favorites = action.payload.toSorted((favA, favB) => (getFavLabel(favA) > getFavLabel(favB) ? 1 : -1));
      state.favorites = favorites;
    },
    setModelName: (state, action: { payload: string }) => {
      state.modelName = getSupportedModelName(action.payload);
    },
    setTimeMs: (state, action: { payload: number }) => {
      state.timeMs = Math.round(action.payload);
    },
    setWidth: (state, action: { payload: number }) => {
      state.width = action.payload;
    },
    setHeight: (state, action: { payload: number }) => {
      state.height = action.payload;
    },
    setLocation: (state, action: { payload: LatLon }) => {
      if (state.location.lat !== action.payload.lat || state.location.lon !== action.payload.lon) {
        state.location = action.payload;
        state.locationName = null;
      }
    },
    setLocationName: (state, action: { payload: string | null }) => {
      state.locationName = action.payload;
    },
    setStatus: (state, action: { payload: PluginStatus }) => {
      state.status = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchLocationName.pending, (state) => {
      state.locationName = null;
    });
    builder.addCase(fetchLocationName.fulfilled, (state, action) => {
      state.locationName = action.payload;
    });
    builder.addCase(fetchLocationName.rejected, (state, action) => {
      // Avoid clearing place name if skipped by condition or cancelled
      if (!action.meta.condition && !action.meta.aborted) {
        state.locationName = null;
      }
    });
  },
});

export const selWidth = (state: RootState): number => state[slice.name].width;
export const selHeight = (state: RootState): number => state[slice.name].height;
export const selModelName = (state: RootState): string => state[slice.name].modelName;
export const selTimeMs = (state: RootState): number => state[slice.name].timeMs;
export const selIsZoomedIn = (state: RootState): boolean => state[slice.name].isZoomedIn;
export const selLocation = (state: RootState): LatLon => state[slice.name].location;
export const selLocationName = (state: RootState): string | null => state[slice.name].locationName;
export const selFavorites = (state: RootState): Fav[] => state[slice.name].favorites;
export const selStatus = (state: RootState): PluginStatus => state[slice.name].status;

/**
 * Returns the user favorite matching the current location (if any).
 */
export const selMatchingFavorite = createSelector(
  [selFavorites, selLocation],
  (favorites, location): Fav | undefined => {
    const locationStr = latLon2Str(location);
    return favorites.find((fav) => latLon2Str(fav) === locationStr);
  },
);

/**
 * Computes the location label: matching favorite title > reverse-geocoded place name > GPS coordinates fallback.
 */
export const selLocationLabel = createSelector(
  [selMatchingFavorite, selLocationName, selLocation],
  (matchingFav, locationName, location): string => {
    if (matchingFav) {
      return getFavLabel(matchingFav);
    }
    if (locationName) {
      return locationName;
    }
    return W.geolocation.getFallbackName(location.lat, location.lon);
  },
);

export const {
  setIsZoomedIn,
  setFavorites,
  setModelName,
  setTimeMs,
  setWidth,
  setHeight,
  setLocation,
  setLocationName,
  setStatus,
} = slice.actions;

export const { reducer } = slice;
