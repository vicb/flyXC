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
  // time in seconds.
  timeSec: number;
  view3d: boolean;
  loadingApi: boolean;
};

const initialState: AppState = {
  chartYAxis: ChartYAxis.Altitude,
  loadingApi: false,
  timeSec: 0,
  view3d: getSearchParams().has(ParamNames.view3d),
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTimeSec: (state, action: PayloadAction<number>) => {
      state.timeSec = action.payload;
    },
    setApiLoading: (state, action: PayloadAction<boolean>) => {
      state.loadingApi = action.payload;
    },
    setChartYAxis: (state, action: PayloadAction<ChartYAxis>) => {
      state.chartYAxis = action.payload;
    },
    setView3d: (state, action: PayloadAction<boolean>) => {
      if (action.payload) {
        addUrlParamValue(ParamNames.view3d, '');
      } else {
        deleteUrlParam(ParamNames.view3d);
      }
      state.view3d = action.payload;
    },
  },
});

export const reducer = appSlice.reducer;
export const { setTimeSec, setApiLoading, setChartYAxis, setView3d } = appSlice.actions;
