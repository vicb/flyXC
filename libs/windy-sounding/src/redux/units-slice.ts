import { createSelector, createSlice } from '@reduxjs/toolkit';

import { formatLayerAltitude, formatRainAmount } from '../util/utils';
import type { RootState } from './store';

const windyStore = W.store;
const windyMetrics = W.metrics;

export type TempUnit = 'K' | '°C' | '°F';
export type AltitudeUnit = 'm' | 'ft';
export type SpeedUnit = 'km/h' | 'mph' | 'kt' | 'bft';
export type PressureUnit = 'mmHg' | 'inHg' | 'hPa';
export type RainUnit = 'mm' | 'in';

type UnitsState = {
  tempUnit: TempUnit;
  altitudeUnit: AltitudeUnit;
  windSpeedUnit: SpeedUnit;
  pressureUnit: PressureUnit;
  rainUnit: RainUnit;
};

const initialState: UnitsState = {
  tempUnit: windyStore.get('metric_temp'),
  altitudeUnit: windyStore.get('metric_altitude') ?? 'm',
  windSpeedUnit: windyStore.get('metric_wind'),
  pressureUnit: windyStore.get('metric_pressure'),
  rainUnit: windyStore.get('metric_rain') ?? 'mm',
};

export const slice = createSlice({
  name: 'units',
  initialState,
  reducers: {
    setTempUnit: (state, action: { payload: TempUnit }) => {
      state.tempUnit = action.payload;
    },
    setAltitudeUnit: (state, action: { payload: AltitudeUnit }) => {
      state.altitudeUnit = action.payload;
    },
    setWindSpeedUnit: (state, action: { payload: SpeedUnit }) => {
      state.windSpeedUnit = action.payload;
    },
    setPressureUnit: (state, action: { payload: PressureUnit }) => {
      state.pressureUnit = action.payload;
    },
    setRainUnit: (state, action: { payload: RainUnit }) => {
      state.rainUnit = action.payload;
    },
  },
});

export const selTempUnit = (state: RootState): TempUnit => state[slice.name].tempUnit;
export const selAltitudeUnit = (state: RootState): AltitudeUnit => state[slice.name].altitudeUnit;
export const selWindSpeedUnit = (state: RootState): SpeedUnit => state[slice.name].windSpeedUnit;
export const selPressureUnit = (state: RootState): PressureUnit => state[slice.name].pressureUnit;
export const selRainUnit = (state: RootState): RainUnit => state[slice.name].rainUnit;

export const { setTempUnit, setAltitudeUnit, setWindSpeedUnit, setPressureUnit, setRainUnit } = slice.actions;

export const selTempFormatter = createSelector(
  selTempUnit,
  (unit) => (temp: number) => Math.round(windyMetrics.temp.conv[unit].conversion(temp)),
);

export const selAltitudeFormatter = createSelector(
  selAltitudeUnit,
  (unit) => (altitude: number) =>
    Math.round(windyMetrics.altitude.conv[unit].conversion(Math.round(altitude / 100) * 100)),
);

export const selPressureFormatter = createSelector(
  selPressureUnit,
  (unit) => (pressure: number) => Math.round(windyMetrics.pressure.conv[unit].conversion(pressure)),
);

export const selWindSpeedFormatter = createSelector(
  selWindSpeedUnit,
  (unit) => (windSpeed: number) => Math.round(windyMetrics.wind.conv[unit].conversion(windSpeed)),
);

export const selLayerAltitudeFormatter = createSelector(
  selAltitudeUnit,
  (unit) => (level: string | undefined) => formatLayerAltitude(level, unit),
);

export const selRainFormatter = createSelector(
  selRainUnit,
  (unit) => (rainMm: number | undefined) => formatRainAmount(rainMm, unit),
);

export const { reducer } = slice;

export const selectors = slice.getSelectors((state: RootState) => state.units);
