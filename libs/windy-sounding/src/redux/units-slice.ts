import { createSelector, createSlice } from '@reduxjs/toolkit';

import type { RootState } from './store';

const windyStore = W.store;
const windyMetrics = W.metrics;

export type TempUnit = 'K' | '°C' | '°F';
export type AltitudeUnit = 'm' | 'ft';
export type SpeedUnit = 'km/h' | 'mph' | 'kt' | 'bft';
export type PressureUnit = 'mmHg' | 'inHg' | 'hPa';

type UnitsState = {
  tempUnit: TempUnit;
  altitudeUnit: AltitudeUnit;
  windSpeedUnit: SpeedUnit;
  pressureUnit: PressureUnit;
};

const initialState: UnitsState = {
  tempUnit: windyStore.get('metric_temp'),
  altitudeUnit: windyStore.get('metric_altitude'),
  windSpeedUnit: windyStore.get('metric_wind'),
  pressureUnit: windyStore.get('metric_pressure'),
};

export const slice = createSlice({
  name: 'units',
  initialState,
  reducers: {},
});

export const selTempUnit = (state: RootState): TempUnit => state[slice.name].tempUnit;
export const selAltitudeUnit = (state: RootState): AltitudeUnit => state[slice.name].altitudeUnit;
export const selWindSpeedUnit = (state: RootState): SpeedUnit => state[slice.name].windSpeedUnit;
export const selPressureUnit = (state: RootState): PressureUnit => state[slice.name].pressureUnit;

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

export const { reducer } = slice;

export const selectors = slice.getSelectors((state: RootState) => state.units);
