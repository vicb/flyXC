import { applyMiddleware, combineReducers, createStore } from 'redux';
import thunk, { ThunkDispatch, ThunkMiddleware } from 'redux-thunk';

import { MapAction } from './actions';
import map, { MapState } from './reducers';

// Overall state extends static states and partials lazy states.
export interface RootState {
  map: MapState;
}

export type RootAction = MapAction;

// Initializes the Redux store with a redux-thunk (so that you can dispatch async actions).
export const store = createStore(
  combineReducers({
    map,
  }),
  applyMiddleware(thunk as ThunkMiddleware<RootState, RootAction>),
);

// Override dispatch to be able to dispatch thunk actions.
export const dispatch: ThunkDispatch<RootState, void, RootAction> = store.dispatch;
