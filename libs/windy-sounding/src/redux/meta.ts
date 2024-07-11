import type { LatLon } from '@windy/interfaces';

import { pluginConfig } from '../config';
import * as forecastSlice from './forecast-slice';
import * as pluginSlice from './plugin-slice';
import type { AppDispatch, RootState } from './store';

const { map: windyMap, markers } = W.map;
const windyRootScope = W.rootScope;

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

/**
 * Thunk to set the location.
 *
 * - Update the location
 * - Move the marker
 * - Fetch the forecast
 */
export const changeLocation = (location: LatLon) => (dispatch: AppDispatch, getState: () => RootState) => {
  const modelName = pluginSlice.slice.selectors.selModelName(getState());
  dispatch(pluginSlice.setLocation(location));
  dispatch(forecastSlice.fetchForecast({ modelName, location }));

  changeMarkerLocation(location);

  updateUrl(getState());
};

export const changeModel = (modelName: string) => (dispatch: AppDispatch, getState: () => RootState) => {
  const location = pluginSlice.slice.selectors.selLocation(getState());
  dispatch(pluginSlice.setModelName(modelName));
  dispatch(forecastSlice.fetchForecast({ modelName, location }));
  updateUrl(getState());
};

function updateUrl(state: RootState) {
  const location = pluginSlice.slice.selectors.selLocation(state);
  const modelName = pluginSlice.slice.selectors.selModelName(state);
  W.location.setUrl(pluginConfig.name, { modelName, ...location });
}

let marker: L.Marker | undefined;

export function changeMarkerLocation(latLon: LatLon) {
  const { lon: lng, lat } = latLon;
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

export function removeMarker() {
  if (marker) {
    windyMap.removeLayer(marker);
    marker = undefined;
  }
}

export function centerMap(latLon: LatLon) {
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
    const centerLat = latLon.lat + ((deltaLat / mapHeight) * pluginHeight) / 2;
    windyMap.panTo({ lng: latLon.lon, lat: centerLat });
  } else {
    windyMap.panTo({ lng: latLon.lon, lat: latLon.lat });
  }
}
