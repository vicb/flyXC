import { getHostName } from '@flyxc/common';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { isMobile } from '../logic/browser';

type BrowserState = {
  isFullscreen: boolean;
  isVisible: boolean;
  readonly isInIframe: boolean;
  readonly isFromFfvl: boolean;
  readonly isMobile: boolean;
  readonly isSmallScreen: boolean;
  // Whether the PWA is installed.
  readonly isInstalledPwa: boolean;
  country?: string;
};

export { isMobile };

const doc = document as Document & { webkitFullscreenElement?: boolean };
const isFullscreen = ('webkitFullscreenElement' in doc ? doc.webkitFullscreenElement : doc.fullscreenElement) != null;

const isInIframe = window.parent !== window;
const isFromFfvl = isInIframe && (getHostName(document.referrer) ?? '').endsWith('ffvl.fr');
const isInstalledPwa =
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
  (typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches);

const initialState: BrowserState = {
  isFullscreen,
  isVisible: document.visibilityState == 'visible',
  isInIframe,
  isFromFfvl,
  isMobile: isMobile(),
  isSmallScreen:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? !window.matchMedia('(min-width: 640px)').matches
      : false,
  isInstalledPwa,
  country: undefined,
};

const browserSlice = createSlice({
  name: 'browser',
  initialState,
  reducers: {
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    setIsVisible: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload;
    },
    setCountry: (state, action: PayloadAction<string | undefined>) => {
      state.country = action.payload;
    },
  },
  selectors: {
    selectIsFullscreen: (state) => state.isFullscreen,
    selectIsVisible: (state) => state.isVisible,
    selectIsInIframe: (state) => state.isInIframe,
    selectIsFromFfvl: (state) => state.isFromFfvl,
    selectIsMobile: (state) => state.isMobile,
    selectIsSmallScreen: (state) => state.isSmallScreen,
    selectIsInstalledPwa: (state) => state.isInstalledPwa,
    selectCountry: (state) => state.country,
  },
});

export const reducer = browserSlice.reducer;
export const { setIsFullscreen, setIsVisible, setCountry } = browserSlice.actions;
export const {
  selectIsFullscreen,
  selectIsVisible,
  selectIsInIframe,
  selectIsFromFfvl,
  selectIsMobile,
  selectIsSmallScreen,
  selectIsInstalledPwa,
  selectCountry,
} = browserSlice.selectors;

/**
 * Initializes browser event listeners for fullscreen and visibility changes,
 * dispatching updates to the Redux store.
 *
 * @param store - The Redux store or dispatch provider.
 */
export function initBrowserEvents(store: { dispatch: (action: any) => void }): void {
  // Handle when full screen is exited by pressing the ESC key.
  window.addEventListener('fullscreenchange', () => {
    store.dispatch(browserSlice.actions.setIsFullscreen(document.fullscreenElement != null));
  });
  window.addEventListener('webkitfullscreenchange', () => {
    store.dispatch(browserSlice.actions.setIsFullscreen(doc.webkitFullscreenElement != null));
  });

  document.addEventListener('visibilitychange', async () => {
    const visible = document.visibilityState == 'visible';
    store.dispatch(browserSlice.actions.setIsVisible(visible));
    if (visible) {
      await getScreenWakeLock();
    }
  });

  fetchCountry(store);
}

/**
 * Requests a screen wake lock if supported by the browser to keep the screen on.
 *
 * @returns A promise resolving when the lock has been requested.
 */
async function getScreenWakeLock(): Promise<void> {
  if ('wakeLock' in navigator) {
    try {
      await (navigator as any).wakeLock.request();
    } catch (err) {
      // empty
    }
  }
}

async function fetchCountry(store: { dispatch: (action: any) => void }): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_SERVER}/api/country`);
    if (response.ok) {
      const { country } = await response.json();
      store.dispatch(browserSlice.actions.setCountry(country));
    }
  } catch {
    // empty
  }
}
