import { createSlice } from '@reduxjs/toolkit';
import type { Fav, LatLon } from '@windy/interfaces';

import { getFavLabel } from '../util/utils';

const windyStore = W.store;

// Some models do not have the required parameters for soundings (i.e. surface only)
export const SUPPORTED_MODEL_PREFIXES = ['ecmwf', 'gfs', 'nam', 'icon', 'hrrr', 'ukv', 'arome'];
const DEFAULT_MODEL = 'ecmwf';

type PluginState = {
  favorites: Fav[];
  // Default to true, i.e. PG mode, zoomed out mode is SkewT
  isZoomedIn: boolean;
  modelName: string;
  timeMs: number;
  width: number;
  height: number;
  location: LatLon;
};

const initialState: PluginState = {
  favorites: [],
  isZoomedIn: true,
  width: 0,
  height: 0,
  location: { lat: 0, lon: 0 },
  modelName: windyStore.get('product'),
  timeMs: windyStore.get('timestamp'),
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
  },
});

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
