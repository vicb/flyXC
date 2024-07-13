import './styles.less';

import type { LatLon } from '@windy/interfaces';
import { render } from 'preact';
import { Provider } from 'react-redux';

import { pluginConfig } from './config.js';
import { Plugin } from './containers/containers';
import {
  addSubscription,
  cancelAllSubscriptions,
  centerMap,
  changeLocation,
  changeModel,
  maybeRemoveMarker,
  updateTime,
} from './redux/meta';
import * as pluginSlice from './redux/plugin-slice';
import { store } from './redux/store';
import styles from './styles.less?inline';
import { injectStyles } from './util/utils';

const windyStore = W.store;
const windyUtils = W.utils;
const { map: windyMap } = W.map;
const { emitter: windyPicker } = W.picker;
const windyRootScope = W.rootScope;
const { singleclick } = W.singleclick;
const favs = W.userFavs;

let appContainer: HTMLElement;
let resizeObserver: ResizeObserver | undefined;

export const mountPlugin = (container: HTMLElement) => {
  const { dispatch } = store;
  appContainer = container;
  injectStyles(styles);
  render(
    <Provider store={store}>
      <Plugin />
    </Provider>,
    container,
  );

  if (windyRootScope.isMobileOrTablet) {
    const controller = new AbortController();
    // Swipe Left/Right on the plugin to change the time.
    windyUtils
      .loadScript('https://unpkg.com/swipe-listener@1.3.0/dist/swipe-listener.min.js')
      .then(() => {
        // Make minHorizontal big enough to avoid false positives.
        SwipeListener(appContainer, { minHorizontal: appContainer.offsetWidth / 6, mouse: false });
        appContainer.addEventListener(
          'swipe' as any,
          (e: CustomEvent) => {
            const { right, left } = e.detail.directions;
            const direction = left ? 'backward' : right ? 'forward' : undefined;
            if (direction !== undefined) {
              store.dispatch(updateTime({ direction, size: 'day' }));
            }
          },
          { signal: controller.signal },
        );
        addSubscription(() => controller.abort());
      })
      .catch((e: any) => console.error(e));
  } else {
    const container = document.querySelector('#plugin-windy-plugin-sounding');
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        setSizeFrom(appContainer);
      });
      resizeObserver.observe(container);
      addSubscription(() => resizeObserver?.unobserve(container));
    }
  }

  const timeChangedEventId = windyStore.on('timestamp', () => {
    dispatch(pluginSlice.setTimeMs(windyStore.get('timestamp')));
  });
  addSubscription(() => windyStore.off(timeChangedEventId));

  const productChangedEventId = windyStore.on('product', () => {
    dispatch(changeModel(windyStore.get('product')));
  });
  addSubscription(() => windyStore.off(productChangedEventId));

  const singleClickIdEventId = singleclick.on(pluginConfig.name, (location: LatLon) => {
    dispatch(changeLocation(location));
  });
  addSubscription(() => singleclick.off(singleClickIdEventId));

  // Use the picker events on desktop.
  if (!windyRootScope.isMobileOrTablet) {
    const pickerOpenedEventId = windyPicker.on('pickerOpened', (location: LatLon) => {
      dispatch(changeLocation(location));
    });
    addSubscription(() => windyPicker.off(pickerOpenedEventId));

    const pickerMovedEventId = windyPicker.on('pickerMoved', (location: LatLon) => {
      dispatch(changeLocation(location));
    });
    addSubscription(() => windyPicker.off(pickerMovedEventId));
  }

  const favsChangedEventId = favs.on('favsChanged', () => {
    dispatch(pluginSlice.setFavorites(favs.getArray()));
  });

  addSubscription(() => favs.off(favsChangedEventId));
};

// Called when the plugin is opened
export const openPlugin = ({ lat, lon, modelName }: { lat: number; lon: number; modelName: string }) => {
  const { dispatch } = store;
  const location = { lat, lon };

  windyMap.setZoom(10, { animate: false });
  windyStore.set('overlay', 'clouds');
  centerMap(location);

  dispatch(pluginSlice.setFavorites(favs.getArray()));
  dispatch(pluginSlice.setModelName(modelName));
  dispatch(pluginSlice.setTimeMs(windyStore.get('timestamp')));
  dispatch(changeLocation(location));
  setSizeFrom(appContainer);

  if (pluginSlice.selStatus(store.getState()) === pluginSlice.PluginStatus.Idle) {
    dispatch(pluginSlice.fetchPluginConfig(pluginConfig));
  }
};

// Called when closed
export const destroyPlugin = () => {
  cancelAllSubscriptions();
  maybeRemoveMarker();
};

function setSizeFrom(container: HTMLElement) {
  const padding = W.rootScope.isMobileOrTablet ? 0 : 50;
  const width = container.clientWidth - padding;
  const height = Math.min(width, window.innerHeight * 0.7);
  store.dispatch(pluginSlice.setWidth(width));
  store.dispatch(pluginSlice.setHeight(height));
}
