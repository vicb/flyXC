import { configureStore, EnhancedStore, type DevToolsEnhancerOptions } from '@reduxjs/toolkit';

import * as skewTAct from '../actions/skewt';
import * as soundingAct from '../actions/sounding';
import { rootReducer } from '../reducers/sounding';

const windyStore = W.store;

export type AppStore = EnhancedStore;

let store: AppStore;

export function getStore(container?: HTMLDivElement) {
  if (store) {
    return store;
  }

  const devTools: DevToolsEnhancerOptions | boolean =
    process.env.NODE_ENV === 'development'
      ? false
      : {
          traceLimit: 20,
          trace: false,
          autoPause: true,
        };

  store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
    devTools,
  });

  // TODO: mobile dimension
  const graphWith = container.clientWidth;
  const graphHeight = Math.min(graphWith, window.innerHeight * 0.7);

  store.dispatch(soundingAct.setWidth(graphWith));
  store.dispatch(soundingAct.setHeight(graphHeight));

  updateMetrics(store);

  store.dispatch(skewTAct.setPMin(400));

  return store;
}

export function updateMetrics(store: AppStore) {
  if (store) {
    store.dispatch(soundingAct.setMetricTemp(windyStore.get('metric_temp')));
    store.dispatch(soundingAct.setMetricAltitude(windyStore.get('metric_altitude')));
    store.dispatch(soundingAct.setMetricSpeed(windyStore.get('metric_wind')));
  }
}
