import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Units } from '../logic/units';
import { DistanceUnit, SpeedUnit } from '../logic/units';

const initialState: Units = {
  distance: (localStorage.getItem('unit.distance') ?? DistanceUnit.Kilometers) as DistanceUnit,
  speed: (localStorage.getItem('unit.speed') ?? SpeedUnit.KilometersPerHour) as SpeedUnit,
  altitude: (localStorage.getItem('unit.altitude') ?? DistanceUnit.Meters) as DistanceUnit,
  vario: (localStorage.getItem('unit.vario') ?? SpeedUnit.MetersPerSecond) as SpeedUnit,
};

const unitsSlice = createSlice({
  name: 'units',
  initialState,
  reducers: {
    /** Sets the user's distance unit preference. */
    setDistanceUnit: (state, action: PayloadAction<DistanceUnit>) => {
      state.distance = action.payload;
    },
    /** Sets the user's speed unit preference. */
    setSpeedUnit: (state, action: PayloadAction<SpeedUnit>) => {
      state.speed = action.payload;
    },
    /** Sets the user's altitude unit preference. */
    setAltitudeUnit: (state, action: PayloadAction<DistanceUnit>) => {
      state.altitude = action.payload;
    },
    /** Sets the user's vertical speed (vario) unit preference. */
    setVarioUnit: (state, action: PayloadAction<SpeedUnit>) => {
      state.vario = action.payload;
    },
  },
  selectors: {
    selectUnits: (state) => state,
    selectDistanceUnit: (state) => state.distance,
    selectSpeedUnit: (state) => state.speed,
    selectAltitudeUnit: (state) => state.altitude,
    selectVarioUnit: (state) => state.vario,
  },
});

export const reducer = unitsSlice.reducer;
export const { setDistanceUnit, setSpeedUnit, setAltitudeUnit, setVarioUnit } = unitsSlice.actions;
export const { selectUnits, selectDistanceUnit, selectSpeedUnit, selectAltitudeUnit, selectVarioUnit } =
  unitsSlice.selectors;
