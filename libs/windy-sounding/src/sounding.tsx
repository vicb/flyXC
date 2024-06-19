import './styles.less';

import type { LatLon } from '@windycom/plugin-devtools/types/interfaces.js';
import { render } from 'preact';
import { Provider } from 'react-redux';
import type { Store } from 'redux';

import {
  addSubscription,
  cancelSubscriptions,
  removeMarker,
  setActive,
  setFavorites,
  setLocation,
  setModelName,
  setTime,
} from './actions/sounding.js';
import { App } from './containers/containers.js';
import { centerMap, updateTime } from './selectors/sounding.js';
import { getStore, updateMetrics } from './util/store.js';
import { pluginConfig } from './config';

const windyStore = W.store;
const windyUtils = W.utils;
const { map: windyMap } = W.map;
const { emitter: windyPicker } = W.picker;
const windyRootScope = W.rootScope;
const { singleclick } = W.singleclick;
const favs = W.userFavs;

declare const SwipeListener: any;

let store: Store;

export const mountPlugin = (container: HTMLDivElement) => {
  store = getStore(container);

  render(
    <Provider store={store}>
      <App />
    </Provider>,
    container,
  );

  // todo(vicb)
  if (windyRootScope.isMobileOrTablet) {
    // Tablets use the className instead of classNameMobile.
    const el = document.querySelector('#plugin-windy-plugin-sounding') as HTMLDivElement;
    // Swipe Left/Right on the plugin to change the time.
    windyUtils
      .loadScript('https://unpkg.com/swipe-listener@1.3.0/dist/swipe-listener.min.js')
      .then(() => {
        // Make minHorizontal big enough to avoid false positives.
        SwipeListener(el, { minHorizontal: el.offsetWidth / 6, mouse: false });
        el.addEventListener('swipe', (e: CustomEvent) => {
          const { right, left } = e.detail.directions;
          const direction = left ? -1 : right ? 1 : 0;
          updateTime(getStore(el).getState())({ direction, changeDay: true });
        });
      })
      .catch((e: any) => console.error(e));
  }
};

// Called when the plugin is opened
export const openPlugin = (ll?: LatLon) => {
  let lat: number;
  let lon: number;

  if (!ll || ll.lat == null || ll.lon == null) {
    const c = windyMap.getCenter();
    lat = c.lat;
    lon = c.lng;
  } else {
    lat = Number(ll.lat);
    lon = Number(ll.lon);
  }

  if (!store.getState().plugin.active) {
    // The plugin was previously closed
    windyMap.setZoom(10, { animate: false });
    windyStore.set('overlay', 'clouds');

    const timeChangedEventId = windyStore.on('timestamp', () => {
      store.dispatch(setTime(windyStore.get('timestamp')));
    });
    store.dispatch(addSubscription(() => windyStore.off(timeChangedEventId)));

    const productChangedEventId = windyStore.on('product', () => {
      // @ts-expect-error TS(2345): Argument of type '(dispatch: any) => void' is not ... Remove this comment to see the full error message
      store.dispatch(setModelName(windyStore.get('product')));
    });
    store.dispatch(addSubscription(() => windyStore.off(productChangedEventId)));

    // TODO: name from config
    const singleClickIdEventId = singleclick.on(pluginConfig.name, (ll: LatLon) => {
      setCurrentLocation(ll);
    });
    store.dispatch(addSubscription(() => singleclick.off(singleClickIdEventId)));

    // USe the picker events on desktop.
    if (!windyRootScope.isMobileOrTablet) {
      const pickerOpenedEventId = windyPicker.on('pickerOpened', (ll: LatLon) => {
        setCurrentLocation(ll);
      });
      store.dispatch(addSubscription(() => windyPicker.off(pickerOpenedEventId)));

      const pickerMovedEventId = windyPicker.on('pickerMoved', (ll: LatLon) => {
        setCurrentLocation(ll);
      });
      store.dispatch(addSubscription(() => windyPicker.off(pickerMovedEventId)));
    }

    const favsChangedEventId = favs.on('favsChanged', () => {
      store.dispatch(setFavorites(favs.getArray()));
    });

    store.dispatch(addSubscription(() => favs.off(favsChangedEventId)));
    store.dispatch(setFavorites(favs.getArray()));
    store.dispatch(setActive(true));
  }

  updateMetrics(store);
  centerMap(store.getState())(lat, lon);
  setCurrentLocation({ lat, lon });
  // @ts-expect-error TS(2345): Argument of type '(dispatch: any) => void' is not ... Remove this comment to see the full error message
  store.dispatch(setModelName(windyStore.get('product')));
  store.dispatch(setTime(windyStore.get('timestamp')));
};

// Called when closed
export const destroyPlugin = () => {
  // @ts-expect-error TS(2345): Argument of type '(dispatch: any, getState: any) =... Remove this comment to see the full error message
  store.dispatch(cancelSubscriptions());
  store.dispatch(removeMarker());
  store.dispatch(setActive(false));
};

const setCurrentLocation = (ll: LatLon) => {
  const { lat, lon } = ll;
  // @ts-expect-error TS(2345): Argument of type '(dispatch: Dispatch) => void' is... Remove this comment to see the full error message
  store.dispatch(setLocation(lat, lon));
};
