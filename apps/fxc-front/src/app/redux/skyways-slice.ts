// Thermal and Skyways layers.
//
// See https://thermal.kk7.ch

import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

const TILE_URL = 'https://thermal.kk7.ch/tiles/{layer}/{z}/{x}/{y}.png?src={domain}'.replace(
  '{domain}',
  window.location.hostname,
);

export const TILE_MIN_ZOOM = 0;

export const getTileMaxZoom = (layer: Layer): number => {
  return layer == 'skyways' ? 13 : 12;
};

export const monthMap = {
  all: 'All year',
  jan: 'January',
  apr: 'April',
  jul: 'July',
  oct: 'October',
};

export type Month = keyof typeof monthMap;

export const timeOfDayList = ['all', '04', '07', '10'] as const;
export type TimeOfDay = (typeof timeOfDayList)[number];

export const timeOfDayMap: Record<TimeOfDay, string> = {
  all: 'All day',
  '04': 'Morning',
  '07': 'Midday',
  '10': 'Evening',
};

export const layerMap = {
  skyways: 'Skyways',
  thermals: 'Thermals',
};

export type Layer = keyof typeof layerMap;

type SkywaysState = {
  show: boolean;
  opacity: number;
  month: Month;
  timeOfDay: TimeOfDay;
  layer: Layer;
};

const initialState: SkywaysState = {
  show: false,
  opacity: 100,
  month: 'all',
  timeOfDay: 'all',
  layer: 'skyways',
};

const skywaysSlice = createSlice({
  name: 'skyways',
  initialState,
  reducers: {
    setShow: (state, action: PayloadAction<boolean>) => {
      state.show = action.payload;
    },
    setOpacity: (state, action: PayloadAction<number>) => {
      state.opacity = action.payload;
    },
    setLayer: (state, action: PayloadAction<Layer>) => {
      state.layer = action.payload;
    },
    setMonth: (state, action: PayloadAction<Month>) => {
      state.month = action.payload;
    },
    setTimeOfDay: (state, action: PayloadAction<TimeOfDay>) => {
      state.timeOfDay = action.payload;
    },
  },
});

export const reducer = skywaysSlice.reducer;
export const { setShow, setOpacity, setLayer, setMonth, setTimeOfDay } = skywaysSlice.actions;

export const getTileUrl = createSelector(
  (state: RootState) => state.skyways.layer,
  (state: RootState) => state.skyways.month,
  (state: RootState) => state.skyways.timeOfDay,
  (layer: Layer, month: Month, timeOfDay: TimeOfDay) => {
    return TILE_URL.replace('{layer}', `${layer}_${month}_${timeOfDay}`);
  },
);
