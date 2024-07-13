import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { HttpPayload } from '@windy/http';
import type { CompiledExternalPluginConfig, Fav, LatLon } from '@windy/interfaces';
import { SemVer } from 'semver';

import type { PluginConfig } from '../types';
import { getFavLabel } from '../util/utils';
import { changeLocation } from './meta';
import type { RootState } from './store';

const windyStore = W.store;

const UPDATE_REQUIRED_AFTER_DAYS = 7;

export enum PluginStatus {
  Idle = 'idle',
  Booting = 'booting',
  Ready = 'ready',
}

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
  status: PluginStatus;
  updateAvailable: boolean;
  updateRequired: boolean;
  availableVersion: string;
};

const initialState: PluginState = {
  favorites: [],
  isZoomedIn: true,
  width: 0,
  height: 0,
  location: { lat: 0, lon: 0 },
  modelName: windyStore.get('product'),
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
  selectors: {
    // Values
    selWidth: (state): number => state.width,
    selHeight: (state): number => state.height,
    selModelName: (state): string => state.modelName,
    selTimeMs: (state): number => state.timeMs,
    selIsZoomedIn: (state): boolean => state.isZoomedIn,
    selLocation: (state): LatLon => state.location,
    selFavorites: (state): Fav[] => state.favorites,
    selStatus: (state): PluginStatus => state.status,
    selUpdateAvailable: (state): boolean => state.updateAvailable,
    selUpdateRequired: (state): boolean => state.updateRequired,
    selAvailableVersion: (state): string => state.availableVersion,
  },
});

export const fetchPluginConfig = createAsyncThunk<void, PluginConfig, { state: RootState }>(
  'plugin/fetchPluginConfig',
  async (localPluginConfig: PluginConfig, api) => {
    const payload: HttpPayload<CompiledExternalPluginConfig[]> = await W.http.get('/articles/plugins/list');
    const remoteConfig = findConfig(payload.data, localPluginConfig.name);
    if (!remoteConfig) {
      throw new Error(`plugin "${localPluginConfig.name}" not found`);
    }

    if (new SemVer(localPluginConfig.version).compare(remoteConfig.version) == -1) {
      const updateRequired =
        new Date(remoteConfig.builtReadable).getTime() - localPluginConfig.built >
        UPDATE_REQUIRED_AFTER_DAYS * 24 * 3600 * 1000;
      api.dispatch(slice.actions.setUpdateAvailable(true));
      api.dispatch(slice.actions.setUpdateRequired(updateRequired));
    }
    api.dispatch(slice.actions.setAvailableVersion(remoteConfig.version));
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

export const { setIsZoomedIn, setFavorites, setModelName, setTimeMs, setWidth, setHeight, setLocation, setStatus } =
  slice.actions;

export const { reducer } = slice;
