import type { DataHash, MeteogramDataPayload, WeatherDataPayload } from '@windycom/plugin-devtools/types/interfaces';
import type { Dispatch } from 'redux';

import { pluginConfig } from '../config';

const windyFetch = W.fetch;
const { setUrl } = W.location;
const windyUtils = W.utils;

// plugin
export const SET_LOCATION = 'SDG.SET_LOCATION';
export const SET_MODELNAME = 'SDG.SET_MODEL';
export const SET_TIME = 'SDG.SET_TIME';
export const ADD_SUBSCRIPTION = 'SDG.ADD_SUBSCRIPTION';
export const DELETE_SUBSCRIPTION = 'SDG.DELETE_SUBSCRIPTION';
export const SET_ACTIVE = 'SDG.SET_ACTIVE';
export const MOVE_MARKER = 'SDG.MOVE_MARKER';
export const REMOVE_MARKER = 'SDG.REMOVE_MARKER';
export const SET_WIDTH = 'SDG.SET_WIDTH';
export const SET_HEIGHT = 'SDG.SET_HEIGHT';
export const SET_METRIC_TEMP = 'SDG.SET_METRIC_TEMP';
export const SET_METRIC_ALTITUDE = 'SDG.SET_METRIC_ALTITUDE';
export const SET_METRIC_SPEED = 'SDG.SET_METRIC_SPEED';
export const SET_FAVORITES = 'SDG.SET_FAVORITES';
export const SET_Y_POINTER = 'SDG.SET_Y_POINTER';
export const FETCH_PARAMS = 'SDG.FETCH_PARAMS';
export const RECEIVE_PARAMS = 'SDG.RECEIVE_PARAMS';
export const TOGGLE_ZOOM = 'SDG.TOGGLE_ZOOM';

export const SUPPORTED_MODEL_PREFIXES = ['ecmwf', 'gfs', 'nam', 'icon', 'hrrr', 'ukv', 'aromeReunion', 'aromeAntilles'];
const DEFAULT_MODEL = 'ecmwf';

export const toggleZoom = () => ({
  type: TOGGLE_ZOOM,
});

export const setFavorites = (favorites: any) => ({
  type: SET_FAVORITES,
  payload: favorites,
});

export const setYPointer = (y: any) => ({
  type: SET_Y_POINTER,
  payload: y,
});

export const setMetricTemp = (metric: any) => ({
  type: SET_METRIC_TEMP,
  payload: metric,
});

export const setMetricAltitude = (metric: any) => ({
  type: SET_METRIC_ALTITUDE,
  payload: metric,
});

export const setMetricSpeed = (metric: any) => ({
  type: SET_METRIC_SPEED,
  payload: metric,
});

export const setLocation = (lat: number, lon: number) => (dispatch: Dispatch) => {
  dispatch({
    type: SET_LOCATION,
    payload: { lat, lon },
  });
  dispatch(moveMarker(lat, lon));
  // @ts-expect-error TS(2345): Argument of type '(dispatch: any, getState: any) =... Remove this comment to see the full error message
  dispatch(maybeFetchParams());
  setUrl(pluginConfig.name, { lat, lon });
};

export const setModelName = (modelName: string) => (dispatch: any) => {
  const model = SUPPORTED_MODEL_PREFIXES.some((prefix) => modelName.startsWith(prefix)) ? modelName : DEFAULT_MODEL;

  dispatch({
    type: SET_MODELNAME,
    payload: model,
  });
  dispatch(maybeFetchParams());
};

export const setTime = (timestamp: any) => ({
  type: SET_TIME,
  payload: timestamp,
});

export const addSubscription = (cb: any) => ({
  type: ADD_SUBSCRIPTION,
  payload: cb,
});

function deleteSubscription(cb: any) {
  return {
    type: DELETE_SUBSCRIPTION,
    payload: cb,
  };
}

export const cancelSubscriptions = () => (dispatch: any, getState: any) => {
  getState().plugin.subscriptions.forEach((cb: any) => {
    cb();
    dispatch(deleteSubscription(cb));
  });
};

export const setActive = (active: boolean) => ({
  type: SET_ACTIVE,
  payload: active,
});

export const moveMarker = (lat: number, lon: number) => ({
  type: MOVE_MARKER,
  payload: { lat, lon },
});

export const removeMarker = () => ({
  type: REMOVE_MARKER,
});

export const setWidth = (width: number) => ({
  type: SET_WIDTH,
  payload: width,
});

export const setHeight = (height: number) => ({
  type: SET_HEIGHT,
  payload: height,
});

// params

function shouldFetchForecasts(model: any, lat: number, lon: number) {
  if (!model) {
    return true;
  }
  const key = windyUtils.latLon2str({ lat, lon });
  const forecasts = model[key];
  if (!forecasts) {
    return true;
  }

  if (forecasts.isLoading) {
    return false;
  }

  const now = Date.now();
  return now > forecasts.nextUpdate && now - forecasts.loaded > 60 * 1000;
}

export function maybeFetchParams() {
  return (dispatch: any, getState: any) => {
    const state = getState();
    const { lat, lon, modelName } = state.plugin;
    if (
      lat != null &&
      lon != null &&
      modelName != null &&
      shouldFetchForecasts(getState().models[modelName], lat, lon)
    ) {
      dispatch(fetchParams(lat, lon, modelName));
      const step = 3;
      const pAirData = windyFetch.getMeteogramForecastData(modelName, { lat, lon, step }, { extended: true });
      const pForecast = windyFetch.getPointForecastData(modelName, { lat, lon, step }, 'detail');

      Promise.all([pAirData, pForecast]).then(([airData, forecast]) => {
        dispatch(receiveParams(lat, lon, modelName, airData.data, forecast.data));
      });
    }
  };
}

const fetchParams = (lat: number, lon: number, modelName: string) => ({
  type: FETCH_PARAMS,
  payload: { lat, lon, modelName },
});

const receiveParams = (lat, lon, modelName, airData: MeteogramDataPayload, forecast: WeatherDataPayload<DataHash>) => ({
  type: RECEIVE_PARAMS,
  payload: { lat, lon, modelName, airData, forecast },
});
