import { deleteUrlParam, deleteUrlParamValue, ParamNames, setUrlParamValue } from '../../logic/history';
import { decrementSpeed, incrementSpeed, setLeague, setRoute, setSpeedKmh } from '../planner-slice';
import type { AppStartListening } from '../store';
import { removeTracksByGroupIds } from '../track-slice';

/**
 * Registers listeners to synchronize planner and track states with browser URL search parameters.
 *
 * Keeps URL parameters aligned with application state for shareable links and navigation history,
 * without having side-effects embedded inside Redux reducers.
 *
 * @param startListening - The typed startListening function.
 */
export function setupUrlSyncListener(startListening: AppStartListening): void {
  // Sync speed changes in planner
  startListening({
    actionCreator: setSpeedKmh,
    effect: (_, listenerApi) => {
      const { speedKmh } = listenerApi.getState().planner;
      setUrlParamValue(ParamNames.speed, speedKmh.toFixed(1));
    },
  });

  startListening({
    actionCreator: incrementSpeed,
    effect: (_, listenerApi) => {
      const { speedKmh } = listenerApi.getState().planner;
      setUrlParamValue(ParamNames.speed, speedKmh.toFixed(1));
    },
  });

  startListening({
    actionCreator: decrementSpeed,
    effect: (_, listenerApi) => {
      const { speedKmh } = listenerApi.getState().planner;
      setUrlParamValue(ParamNames.speed, speedKmh.toFixed(1));
    },
  });

  // Sync league change in planner
  startListening({
    actionCreator: setLeague,
    effect: (action) => {
      setUrlParamValue(ParamNames.league, action.payload);
    },
  });

  // Sync route change in planner
  startListening({
    actionCreator: setRoute,
    effect: (action) => {
      const route = action.payload;
      if (route.length === 0) {
        deleteUrlParam(ParamNames.route);
      } else {
        setUrlParamValue(ParamNames.route, route);
      }
    },
  });

  // Sync removed track group IDs
  startListening({
    actionCreator: removeTracksByGroupIds,
    effect: (action) => {
      const groupIds = action.payload.map(String);
      groupIds.forEach((groupId) => deleteUrlParamValue(ParamNames.groupId, groupId));
    },
  });
}
