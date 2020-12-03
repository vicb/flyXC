import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { addUrlParamValue, deleteUrlParam, getSearchParams, ParamNames } from '../logic/history';

// Y axis of the chart.
export const enum ChartYAxis {
  Altitude,
  Speed,
  Vario,
}

type AppState = {
  chartYAxis: ChartYAxis;
  // Whether to move the map to see the pilot.
  centerMap: boolean;
  // Display pilot labels for live tracks.
  displayLiveNames: boolean;
  // Display pilot labels for tracks.
  displayNames: boolean;
  timestamp: number;
  view3d: boolean;
  loadingApi: boolean;
};

const initialState: AppState = {
  centerMap: true,
  chartYAxis: ChartYAxis.Altitude,
  displayLiveNames: true,
  displayNames: false,
  loadingApi: false,
  timestamp: 0,
  view3d: getSearchParams().has(ParamNames.view3d),
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTimestamp: (state, action: PayloadAction<number>) => {
      state.timestamp = action.payload;
    },
    setApiLoading: (state, action: PayloadAction<boolean>) => {
      state.loadingApi = action.payload;
    },
    setChartYAxis: (state, action: PayloadAction<ChartYAxis>) => {
      state.chartYAxis = action.payload;
    },
    setDisplayNames: (state, action: PayloadAction<boolean>) => {
      state.displayNames = action.payload;
    },
    setDisplayLiveNames: (state, action: PayloadAction<boolean>) => {
      state.displayLiveNames = action.payload;
    },
    setView3d: (state, action: PayloadAction<boolean>) => {
      if (action.payload) {
        addUrlParamValue(ParamNames.view3d, '');
      } else {
        deleteUrlParam(ParamNames.view3d);
      }
      state.view3d = action.payload;
    },
    setCenterMap: (state, action: PayloadAction<boolean>) => {
      state.centerMap = action.payload;
    },
  },
});

export const reducer = appSlice.reducer;
export const {
  setTimestamp,
  setApiLoading,
  setChartYAxis,
  setDisplayNames,
  setDisplayLiveNames,
  setView3d,
  setCenterMap,
} = appSlice.actions;
