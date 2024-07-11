import { createSlice } from '@reduxjs/toolkit';

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
  selectors: {
    // Values
    selTempUnit: (state): TempUnit => state.tempUnit,
    selAltitudeUnit: (state): AltitudeUnit => state.altitudeUnit,
    selWindSpeedUnit: (state): SpeedUnit => state.windSpeedUnit,
    selPressureUnit: (state): PressureUnit => state.pressureUnit,
    // Formatters
    selTempFormatter:
      (state): ((temp: number) => number) =>
      (temp: number) =>
        Math.round(windyMetrics.temp.conv[slice.getSelectors().selTempUnit(state)].conversion(temp)),
    selAltitudeFormatter:
      (state): ((altitude: number) => number) =>
      (altitude: number) =>
        Math.round(
          windyMetrics.altitude.conv[slice.getSelectors().selAltitudeUnit(state)].conversion(
            Math.round(altitude / 100) * 100,
          ),
        ),
    selPressureFormatter:
      (state): ((pressure: number) => number) =>
      (pressure: number) =>
        Math.round(windyMetrics.pressure.conv[slice.getSelectors().selPressureUnit(state)].conversion(pressure)),
    selWindSpeedFormatter:
      (state): ((windSpeed: number) => number) =>
      (windSpeed: number) =>
        Math.round(windyMetrics.wind.conv[slice.getSelectors().selWindSpeedUnit(state)].conversion(windSpeed)),
  },
});

export const { reducer } = slice;

export const selectors = slice.getSelectors((state: RootState) => state.units);
