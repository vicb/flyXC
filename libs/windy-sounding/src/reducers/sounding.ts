import { combineReducers } from 'redux';

import {
  ADD_SUBSCRIPTION,
  DELETE_SUBSCRIPTION,
  FETCH_PARAMS,
  MOVE_MARKER,
  RECEIVE_PARAMS,
  REMOVE_MARKER,
  SET_ACTIVE,
  SET_FAVORITES,
  SET_HEIGHT,
  SET_LOCATION,
  SET_METRIC_ALTITUDE,
  SET_METRIC_SPEED,
  SET_METRIC_TEMP,
  SET_MODELNAME,
  SET_TIME,
  SET_WIDTH,
  SET_Y_POINTER,
  TOGGLE_ZOOM,
} from '../actions/sounding';
import * as atm from '../util/atmosphere';
import { skewt } from './skewt';
import { windgram } from './wind';

const { map: windyMap, markers } = W.map;
const windyUtils = W.utils;
const windyProducts = W.products;
const windySubscription = W.subscription;

const { pulsatingIcon } = markers;

function metrics(state = {}, action: any) {
  switch (action.type) {
    case SET_METRIC_TEMP: {
      return { ...state, temp: action.payload };
    }
    case SET_METRIC_ALTITUDE: {
      return { ...state, altitude: action.payload };
    }
    case SET_METRIC_SPEED: {
      return { ...state, speed: action.payload };
    }
    default:
      return state;
  }
}

// plugin

function plugin(state = { subscriptions: [], favorites: [], zoom: true, marker: undefined }, action: any) {
  switch (action.type) {
    case SET_LOCATION:
      return { ...state, ...action.payload };
    case SET_MODELNAME:
      return { ...state, modelName: action.payload };
    case SET_TIME:
      return { ...state, timestamp: action.payload };
    case ADD_SUBSCRIPTION: {
      return { ...state, subscriptions: state.subscriptions.concat(action.payload) };
    }
    case DELETE_SUBSCRIPTION: {
      return { ...state, subscriptions: state.subscriptions.filter((fn) => fn != action.payload) };
    }
    case SET_ACTIVE:
      return { ...state, active: action.payload };
    case MOVE_MARKER: {
      let { marker } = state;
      const { lon: lng, lat } = action.payload;
      if (!marker) {
        marker = L.marker(
          { lat, lng },
          {
            icon: pulsatingIcon,
            zIndexOffset: -300,
          },
        ).addTo(windyMap);
        return { ...state, marker };
      }
      marker.setLatLng({ lat, lng });
      return state;
    }
    case REMOVE_MARKER: {
      const { marker } = state;
      if (marker) {
        windyMap.removeLayer(marker);
      }
      return { ...state, marker: null };
    }
    case SET_WIDTH:
      return { ...state, width: action.payload };
    case SET_HEIGHT:
      return { ...state, height: action.payload };
    case SET_FAVORITES: {
      return { ...state, favorites: [...action.payload] };
    }
    case SET_Y_POINTER: {
      return { ...state, yPointer: action.payload };
    }
    case TOGGLE_ZOOM:
      return { ...state, zoom: !state.zoom };
    default:
      return state;
  }
}

// params
function extractAirDataParam(airData: any, param: any, levels: any, tsIndex: any) {
  return levels.map((level: any) => {
    const valueByTs = airData.data[`${param}-${level}h`];
    const value = Array.isArray(valueByTs) ? valueByTs[tsIndex] : null;
    if (param === 'gh' && value == null) {
      // Approximate gh when not provided by the model
      return Math.round(atm.getElevation(level));
    }
    return value;
  });
}

function extractLevels(airData: any) {
  const levels = [];

  for (const name in airData.data) {
    const m = name.match(/temp-(\d+)h$/);
    if (m) {
      levels.push(Number(m[1]));
    }
  }

  return levels.sort((a, b) => (Number(a) < Number(b) ? 1 : -1));
}

function computeForecasts(modelName: any, airData: any, forecast: any) {
  const times = airData.data.hours;
  const levels = extractLevels(airData);

  const values = [];
  let tMax = Number.MIN_VALUE;
  let tMin = Number.MAX_VALUE;
  for (let i = 0; i < times.length; i++) {
    const temp = extractAirDataParam(airData, 'temp', levels, i);
    tMax = Math.max(tMax, ...temp);
    tMin = Math.min(tMin, ...temp);
    values.push({
      temp,
      dewpoint: extractAirDataParam(airData, 'dewpoint', levels, i),
      gh: extractAirDataParam(airData, 'gh', levels, i),
      wind_u: extractAirDataParam(airData, 'wind_u', levels, i),
      wind_v: extractAirDataParam(airData, 'wind_v', levels, i),
    });
  }

  const interval = windySubscription.hasAny()
    ? windyProducts[modelName].intervalPremium || windyProducts[modelName].interval
    : windyProducts[modelName].interval;
  const nextUpdate = forecast.header.updateTs + (interval + 60) * 60 * 1000;

  return {
    airData,
    forecast,
    times,
    values,
    levels,
    tMax,
    tMin,
    pMax: levels.at(-1),
    pMin: levels[0],
    nextUpdate,
  };
}

function forecasts(state = { isLoading: false }, action: any, modelName: any) {
  switch (action.type) {
    case FETCH_PARAMS:
      return { ...state, isLoading: true };
    case RECEIVE_PARAMS: {
      const { airData, forecast } = action.payload;
      const forecasts = computeForecasts(modelName, airData, forecast);
      return { ...state, ...forecasts, isLoading: false, loaded: Date.now() };
    }
    default:
      return state;
  }
}

function models(state = {}, action: any) {
  switch (action.type) {
    case FETCH_PARAMS:
    case RECEIVE_PARAMS: {
      const { modelName } = action.payload;
      const model = state[modelName] || {};
      const key = windyUtils.latLon2str(action.payload);
      return {
        ...state,
        [modelName]: { ...model, [key]: forecasts(model[key], action, modelName) },
      };
    }
    default:
      return state;
  }
}

export const rootReducer = combineReducers({ plugin, models, metrics, skewt, windgram });
