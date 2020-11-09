import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { store } from './store';

type BrowserState = {
  isFullscreen: boolean;
  isVisible: boolean;
  readonly isInIframe: boolean;
  readonly isMobile: boolean;
  readonly isSmallScreen: boolean;
};

const initialState: BrowserState = {
  isFullscreen: document.fullscreenElement != null,
  isVisible: document.visibilityState == 'visible',
  isInIframe: window.parent !== window,
  // https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent),
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

window.addEventListener('fullscreenchange', () => {
  // Handle when full screen is exited by pressing the ESC key.
  store.dispatch(browserSlice.actions.setIsFullscreen(document.fullscreenElement != null));
});

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState == 'visible';
  store.dispatch(browserSlice.actions.setIsVisible(visible));
});
