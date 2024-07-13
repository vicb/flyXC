import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { LatLon } from '@windy/interfaces';

import { pluginConfig } from '../config';
import * as forecastSlice from './forecast-slice';
import * as pluginSlice from './plugin-slice';
import type { RootState } from './store';

const { map: windyMap, markers } = W.map;
const windyRootScope = W.rootScope;

// Cross slice thunks

export type TimeStep = {
  direction: 'forward' | 'backward';
  size: 'hour' | 'day';
};

export const updateTime =
  (step: TimeStep): ThunkAction<void, RootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const stepDays = step.size === 'day';

    const windyStore = W.store;
    let timeMs = windyStore.get('timestamp');
    const stepHour = 3600 * 1000 * (step.direction === 'forward' ? 1 : -1);

    if (stepDays) {
      const state = getState();
      const pluginSel = pluginSlice.slice.selectors;
      const forecastSel = forecastSlice.slice.selectors;
      const modelName = pluginSel.selModelName(state);
      const location = pluginSel.selLocation(state);
      const isWindyDataAvailable = forecastSlice.slice.selectors.selIsWindyDataAvailable(state, modelName, location);

      if (isWindyDataAvailable) {
        // Step to the next/previous at 13h when we know the local TZ offset.
        const date = new Date(timeMs);
        date.setUTCMinutes(0);
        timeMs = date.getTime();
        const utcOffset = forecastSel.selTzOffsetH(state, modelName, location);
        const currentHour = (date.getUTCHours() + utcOffset) % 24;
        const deltaHours = (13 - currentHour) * (step.direction === 'forward' ? 1 : -1);
        timeMs += stepHour * (deltaHours > 0 ? deltaHours : 24 + deltaHours);
      } else {
        // Step +/- 24 when TZ offset is not known
        timeMs += stepHour * 24;
      }
    } else {
      timeMs += stepHour;
    }

    windyStore.set('timestamp', timeMs);
  };

/**
 * Thunk to set the location.
 *
 * - Update the location
 * - Move the marker
 * - Fetch the forecast
 */
export const changeLocation =
  (location: LatLon): ThunkAction<void, RootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const modelName = pluginSlice.slice.selectors.selModelName(getState());
    dispatch(forecastSlice.fetchForecast({ modelName, location }));
    dispatch(pluginSlice.setLocation(location));

    maybeCreateAndMoveMarker(location);

    updateUrl(getState());
  };

export const changeModel =
  (modelName: string): ThunkAction<void, RootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const location = pluginSlice.slice.selectors.selLocation(getState());
    dispatch(forecastSlice.fetchForecast({ modelName, location }));
    dispatch(pluginSlice.setModelName(modelName));
    updateUrl(getState());
  };

function updateUrl(state: RootState) {
  const location = pluginSlice.slice.selectors.selLocation(state);
  const modelName = pluginSlice.slice.selectors.selModelName(state);
  W.location.setUrl(pluginConfig.name, { modelName, ...location });
}

let marker: L.Marker | undefined;

export function maybeCreateAndMoveMarker(location: LatLon) {
  const { lon: lng, lat } = location;
  if (marker) {
    marker.setLatLng({ lat, lng });
    return;
  }

  marker = L.marker(
    { lat, lng },
    {
      icon: markers.pulsatingIcon,
      zIndexOffset: -300,
    },
  ).addTo(windyMap);
}

export function maybeRemoveMarker() {
  if (marker) {
    windyMap.removeLayer(marker);
    marker = undefined;
  }
}

/**
 * Centers the map view at a specified location, adjusting for mobile/tablet view if necessary.
 * @param location - The latitude and longitude coordinates to center the map at.
 */
export function centerMap(location: LatLon) {
  if (windyRootScope.isMobileOrTablet) {
    const pluginContent = document.querySelector('#plugin-windy-plugin-sounding') as HTMLDivElement;
    if (!pluginContent) {
      return;
    }
    // The center should be on the portion of the map visible above the plugin.
    const pluginHeight = pluginContent.offsetHeight;
    const mapHeight = windyMap.getSize().y;
    const bounds = windyMap.getBounds();
    const deltaLat = bounds.getSouth() - bounds.getNorth();
    const centerLat = location.lat + ((deltaLat / mapHeight) * pluginHeight) / 2;
    windyMap.panTo({ lng: location.lon, lat: centerLat });
  } else {
    windyMap.panTo({ lng: location.lon, lat: location.lat });
  }
}

// Subscription

type Subscription = () => void;

const subscriptions: Subscription[] = [];

export function addSubscription(fn: Subscription) {
  subscriptions.push(fn);
}

export function cancelAllSubscriptions() {
  for (const fn of subscriptions) {
    fn();
  }
  subscriptions.length = 0;
}
