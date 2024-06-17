import type { PayloadAction, Store } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export const UPDATE_APP_TIME_EVERY_MIN = 10;

// Do not show the install prompt after install has been cancelled.
const PWA_INSTALL_CANCELLED_KEY = 'pwa-install-cancelled';

// Y axis of the chart.
export enum ChartYAxis {
  Altitude,
  Speed,
  Vario,
}

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
      localStorage.setItem(PWA_INSTALL_CANCELLED_KEY, String(action.payload));
    },
  },
});

export const reducer = appSlice.reducer;
export const { setTimeSec, setApiLoading, setChartYAxis, setView3d, setPwaInstallCancelled } = appSlice.actions;

// Set the app time to the current time when there is no loaded track.
// Track time is used when any track is loaded.
export function updateAppTime(store: Store) {
  if (store.getState().track.tracks.ids.length == 0) {
    store.dispatch(appSlice.actions.setTimeSec(Math.round(new Date().getTime() / 1000)));
  }
}
