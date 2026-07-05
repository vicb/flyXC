import { createSlice } from '@reduxjs/toolkit';
import type { Fav } from '@windy/favs';
import type { LatLon } from '@windy/interfaces';

import { getFavLabel, getSupportedModelName } from '../util/utils';
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
  status: PluginStatus;
};

const initialState: PluginState = {
  favorites: [],
  isZoomedIn: true,
  width: 100,
  height: 100,
  location: { lat: 0, lon: 0 },
  modelName: 'ecmwf',
  timeMs: windyStore.get('timestamp'),
  status: PluginStatus.Idle,
};

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
      state.location = action.payload;
    },
    setStatus: (state, action: { payload: PluginStatus }) => {
      state.status = action.payload;
    },
  },
});

export const selWidth = (state: RootState): number => state[slice.name].width;
export const selHeight = (state: RootState): number => state[slice.name].height;
export const selModelName = (state: RootState): string => state[slice.name].modelName;
export const selTimeMs = (state: RootState): number => state[slice.name].timeMs;
export const selIsZoomedIn = (state: RootState): boolean => state[slice.name].isZoomedIn;
export const selLocation = (state: RootState): LatLon => state[slice.name].location;
export const selFavorites = (state: RootState): Fav[] => state[slice.name].favorites;
export const selStatus = (state: RootState): PluginStatus => state[slice.name].status;

export const { setIsZoomedIn, setFavorites, setModelName, setTimeMs, setWidth, setHeight, setLocation, setStatus } =
  slice.actions;

export const { reducer } = slice;
