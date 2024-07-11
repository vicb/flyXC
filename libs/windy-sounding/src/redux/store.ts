import type { DevToolsEnhancerOptions, GetThunkAPI } from '@reduxjs/toolkit';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import * as forecastSlice from '../redux/forecast-slice';
import * as pluginSlice from '../redux/plugin-slice';
import * as unitsSlice from '../redux/units-slice';

export type AppGetState = typeof store.getState;
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunkAPI = GetThunkAPI<{ state: RootState; dispatch: AppDispatch }>;

const devTools: DevToolsEnhancerOptions | boolean =
  process.env.NODE_ENV === 'development'
    ? {
        trace: false,
        autoPause: true,
      }
    : false;

export const store = configureStore({
  reducer: combineReducers({
    [pluginSlice.slice.name]: pluginSlice.reducer,
    [unitsSlice.slice.name]: unitsSlice.reducer,
    [forecastSlice.slice.name]: forecastSlice.reducer,
  }),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
  devTools,
});
