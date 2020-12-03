import { ThunkAction } from 'redux-thunk';

import { Action, combineReducers, configureStore } from '@reduxjs/toolkit';

import * as airspace from './airspace-slice';
import * as app from './app-slice';
import * as arcgis from './arcgis-slice';
import * as browser from './browser-slice';
import * as liveTrack from './live-track-slice';
import * as location from './location-slice';
import * as planner from './planner-slice';
import * as track from './track-slice';
import * as units from './units-slice';

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk = ThunkAction<void, RootState, unknown, Action<string>>;

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
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  devTools: {
    traceLimit: 20,
    trace: false,
    autoPause: true,
  },
});

liveTrack.handleVisibility();
