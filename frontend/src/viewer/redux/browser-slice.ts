import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { store } from './store';

type BrowserState = {
  isFullscreen: boolean;
  isVisible: boolean;
  readonly isInIframe: boolean;
  readonly isMobile: boolean;
  readonly isSmallScreen: boolean;
};

// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
export const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);

const doc = document as any;
const isFullscreen = ('webkitFullscreenElement' in doc ? doc.webkitFullscreenElement : doc.fullscreenElement) != null;

const initialState: BrowserState = {
  isFullscreen,
  isVisible: document.visibilityState == 'visible',
  isInIframe: window.parent !== window,
  isMobile: isMobile(),
  isSmallScreen: !window.matchMedia('(min-width: 640px)').matches,
};

const browserSlice = createSlice({
  name: 'units',
  initialState,
  reducers: {
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    setIsVisible: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload;
    },
  },
});

export const reducer = browserSlice.reducer;

// Handle when full screen is exited by pressing the ESC key.
window.addEventListener('fullscreenchange', () => {
  store.dispatch(browserSlice.actions.setIsFullscreen(document.fullscreenElement != null));
});
window.addEventListener('webkitfullscreenchange', () => {
  store.dispatch(browserSlice.actions.setIsFullscreen(doc.webkitFullscreenElement != null));
});

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState == 'visible';
  store.dispatch(browserSlice.actions.setIsVisible(visible));
});
