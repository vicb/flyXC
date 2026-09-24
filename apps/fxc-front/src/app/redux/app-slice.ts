import type { PayloadAction, Store } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { ChartYAxis } from '../components/chart-element';

export { ChartYAxis };

export const UPDATE_APP_TIME_EVERY_MIN = 10;

// Do not show the install prompt after install has been cancelled.
const PWA_INSTALL_CANCELLED_KEY = 'pwa-install-cancelled';

type AppState = {
  chartYAxis: ChartYAxis;
  // time in seconds.
  timeSec: number;
  view3d: boolean;
  loadingApi: boolean;
  // Whether the user cancelled the PWA install.
  // In that case do not show the prompt again.
  pwaInstallCancelled: boolean;
};

const initialState: AppState = {
  chartYAxis: ChartYAxis.Altitude,
  loadingApi: true,
  timeSec: Math.round(new Date().getTime() / 1000),
  view3d: false,
  pwaInstallCancelled: localStorage.getItem(PWA_INSTALL_CANCELLED_KEY) === 'true',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTimeSec: (state, action: PayloadAction<number>) => {
      state.timeSec = Math.round(action.payload);
    },
    setApiLoading: (state, action: PayloadAction<boolean>) => {
      state.loadingApi = action.payload;
    },
    setChartYAxis: (state, action: PayloadAction<ChartYAxis>) => {
      state.chartYAxis = action.payload;
    },
    setView3d: (state, action: PayloadAction<boolean>) => {
      state.view3d = action.payload;
    },
    setPwaInstallCancelled: (state, action: PayloadAction<boolean>) => {
      state.pwaInstallCancelled = action.payload;
    },
  },
  selectors: {
    selectChartYAxis: (state) => state.chartYAxis,
    selectTimeSec: (state) => state.timeSec,
    selectView3d: (state) => state.view3d,
    selectLoadingApi: (state) => state.loadingApi,
    selectPwaInstallCancelled: (state) => state.pwaInstallCancelled,
  },
});

export const reducer = appSlice.reducer;
export const { setTimeSec, setApiLoading, setChartYAxis, setView3d, setPwaInstallCancelled } = appSlice.actions;
export const { selectChartYAxis, selectTimeSec, selectView3d, selectLoadingApi, selectPwaInstallCancelled } =
  appSlice.selectors;

/**
 * Sets the app time to the current clock time when there are no loaded runtime tracks
 * and no live track is currently selected.
 *
 * When tracks are loaded or a live track is selected, the track's own timestamp range is used instead.
 *
 * @param store - The Redux store instance.
 */
export function updateAppTime(store: Store): void {
  const state = store.getState() as any;
  if (state.track?.tracks?.ids?.length == 0 && state.liveTrack?.currentLiveId == null) {
    store.dispatch(appSlice.actions.setTimeSec(Math.round(new Date().getTime() / 1000)));
  }
}
