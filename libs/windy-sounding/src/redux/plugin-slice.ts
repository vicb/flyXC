import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Fav } from '@windy/favs';
import type { HttpPayload } from '@windy/http';
import type { CompiledExternalPluginConfig, LatLon } from '@windy/interfaces';
import { SemVer } from 'semver';

import type { PluginConfig } from '../types';
import { getFavLabel, getSupportedModelName } from '../util/utils';
import { changeLocation } from './meta';
import type { RootState } from './store';

const windyStore = W.store;

const UPDATE_REQUIRED_AFTER_DAYS = 7;

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
  updateAvailable: boolean;
  updateRequired: boolean;
  availableVersion: string;
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
  updateAvailable: false,
  updateRequired: false,
  availableVersion: '',
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
    setUpdateAvailable: (state, action: { payload: boolean }) => {
      state.updateAvailable = action.payload;
    },
    setUpdateRequired: (state, action: { payload: boolean }) => {
      state.updateRequired = action.payload;
    },
    setAvailableVersion: (state, action: { payload: string }) => {
      state.availableVersion = action.payload;
    },
  },
});

export const fetchPluginConfig = createAsyncThunk<void, PluginConfig, { state: RootState }>(
  'plugin/fetchPluginConfig',
  async (localPluginConfig: PluginConfig, api) => {
    let payload: HttpPayload<CompiledExternalPluginConfig[]> | undefined;
    let remoteConfig: CompiledExternalPluginConfig | undefined;
    try {
      payload = await W.http.get('/plugins/list');
      remoteConfig = findConfig(payload.data, localPluginConfig.name);
    } catch (e) {
      console.error(`Could not load remote plugin config`, e);
    }

    if (remoteConfig) {
      if (new SemVer(localPluginConfig.version).compare(remoteConfig.version) == -1) {
        const updateRequired =
          Date.now() - new Date(remoteConfig.builtReadable).getTime() > UPDATE_REQUIRED_AFTER_DAYS * 24 * 3600 * 1000;
        api.dispatch(slice.actions.setUpdateAvailable(true));
        api.dispatch(slice.actions.setUpdateRequired(updateRequired));
      }
      api.dispatch(slice.actions.setAvailableVersion(remoteConfig.version));
    } else {
      console.error('Can not load remote plugin config.');
      // The plugin might not have been upload yet when in dev mode.
      api.dispatch(slice.actions.setUpdateAvailable(false));
      api.dispatch(slice.actions.setUpdateRequired(false));
    }

    api.dispatch(slice.actions.setStatus(PluginStatus.Ready));
    api.dispatch(changeLocation(api.getState().plugin.location));
  },
);

/**
 * Finds and returns a specific plugin configuration by name.
 *
 * @param configs - The array of plugin configurations to search through.
 * @param pluginName - The name of the plugin to find.
 * @returns The found plugin configuration, or undefined if not found.
 */
function findConfig(
  configs: CompiledExternalPluginConfig[],
  pluginName: string,
): CompiledExternalPluginConfig | undefined {
  for (const config of configs) {
    if (config.name === pluginName) {
      return config;
    }
  }
  return;
}

export const selWidth = (state: RootState): number => state[slice.name].width;
export const selHeight = (state: RootState): number => state[slice.name].height;
export const selModelName = (state: RootState): string => state[slice.name].modelName;
export const selTimeMs = (state: RootState): number => state[slice.name].timeMs;
export const selIsZoomedIn = (state: RootState): boolean => state[slice.name].isZoomedIn;
export const selLocation = (state: RootState): LatLon => state[slice.name].location;
export const selFavorites = (state: RootState): Fav[] => state[slice.name].favorites;
export const selStatus = (state: RootState): PluginStatus => state[slice.name].status;
export const selUpdateAvailable = (state: RootState): boolean => state[slice.name].updateAvailable;
export const selUpdateRequired = (state: RootState): boolean => state[slice.name].updateRequired;
export const selAvailableVersion = (state: RootState): string => state[slice.name].availableVersion;

export const { setIsZoomedIn, setFavorites, setModelName, setTimeMs, setWidth, setHeight, setLocation, setStatus } =
  slice.actions;

export const { reducer } = slice;
