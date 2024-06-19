import type { Store } from 'redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { thunk } from 'redux-thunk';

import * as skewTAct from '../actions/skewt';
import * as soundingAct from '../actions/sounding';
import { rootReducer } from '../reducers/sounding';

const windyStore = W.store;

let store: Store;

export function getStore(container?: HTMLDivElement) {
  if (store) {
    return store;
  }

  const middlewares = [thunk];
  const composeEnhancers =
    (process.env.NODE_ENV == 'development' ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ : null) || compose;
  // TODO: check deprecated
  store = createStore(rootReducer, composeEnhancers(applyMiddleware(...middlewares)));

  // TODO: mobile dimension
  const graphWith = container.clientWidth;
  const graphHeight = Math.min(graphWith, window.innerHeight * 0.7);

  store.dispatch(soundingAct.setWidth(graphWith));
  store.dispatch(soundingAct.setHeight(graphHeight));

  updateMetrics(store);

  store.dispatch(skewTAct.setPMin(400));

  return store;
}

export function updateMetrics(store: Store) {
  if (store) {
    store.dispatch(soundingAct.setMetricTemp(windyStore.get('metric_temp')));
    store.dispatch(soundingAct.setMetricAltitude(windyStore.get('metric_altitude')));
    store.dispatch(soundingAct.setMetricSpeed(windyStore.get('metric_wind')));
  }
}
