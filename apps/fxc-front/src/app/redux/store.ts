import type { Action, DevToolsEnhancerOptions, ThunkAction, TypedStartListening } from '@reduxjs/toolkit';
import {
  combineReducers,
  configureStore,
  createAsyncThunk,
  createListenerMiddleware,
  createSelector,
} from '@reduxjs/toolkit';

import * as airspace from './airspace-slice';
import * as app from './app-slice';
import * as arcgis from './arcgis-slice';
import * as browser from './browser-slice';
import { setupStorageSyncListener } from './listeners/storage-sync';
import { setupUrlSyncListener } from './listeners/url-sync';
import * as liveTrack from './live-track-slice';
import * as location from './location-slice';
import * as planner from './planner-slice';
import * as skyways from './skyways-slice';
import * as track from './track-slice';
import * as units from './units-slice';

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>;

export const listenerMiddleware = createListenerMiddleware();

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export const startAppListening = listenerMiddleware.startListening as AppStartListening;

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
}>();

export const createAppSelector = createSelector.withTypes<RootState>();

const rootReducer = combineReducers({
  airspace: airspace.reducer,
  app: app.reducer,
  browser: browser.reducer,
  location: location.reducer,
  planner: planner.reducer,
  track: track.reducer,
  units: units.reducer,
  liveTrack: liveTrack.reducer,
  arcgis: arcgis.reducer,
  skyways: skyways.reducer,
});

const devTools: DevToolsEnhancerOptions | boolean = import.meta.env.PROD
  ? false
  : {
      traceLimit: 20,
      trace: false,
      autoPause: true,
    };

// Register listener middleware listeners
setupStorageSyncListener(startAppListening);
setupUrlSyncListener(startAppListening);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).prepend(listenerMiddleware.middleware),
  devTools,
});

// Initialize browser event listeners (fullscreen, visibility, screen wake lock).
browser.initBrowserEvents(store);

// Start live tracking worker and polling.
liveTrack.initLiveTracking(store);

// Periodically synchronize app time when no tracks are loaded.
setInterval(() => app.updateAppTime(store), app.UPDATE_APP_TIME_EVERY_MIN * 60 * 1000);
