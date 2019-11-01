import { applyMiddleware, combineReducers, createStore } from 'redux';
import map, { MapState } from './reducers/map';
import thunk, { ThunkMiddleware } from 'redux-thunk';

import { MapAction } from './actions/map';

// Overall state extends static states and partials lazy states.
export interface RootState {
  map?: MapState;
}

export type RootAction = MapAction;

// Initializes the Redux store with a lazyReducerEnhancer (so that you can
// lazily add reducers after the store has been created) and redux-thunk (so
// that you can dispatch async actions). See the "Redux and state management"
// section of the wiki for more details:
// https://github.com/Polymer/pwa-starter-kit/wiki/4.-Redux-and-state-management
export const store = createStore(
  combineReducers({
    map,
  }),
  applyMiddleware(thunk as ThunkMiddleware<RootState, RootAction>),
);
