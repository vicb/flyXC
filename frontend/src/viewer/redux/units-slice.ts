import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DistanceUnit, SpeedUnit, Units } from '../logic/units';

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
    setDistanceUnit: (state, action: PayloadAction<DistanceUnit>) => {
      localStorage.setItem('unit.distance', action.payload);
      state.distance = action.payload;
    },
    setSpeedUnit: (state, action: PayloadAction<SpeedUnit>) => {
      localStorage.setItem('unit.speed', action.payload);
      state.speed = action.payload;
    },
    setAltitudeUnit: (state, action: PayloadAction<DistanceUnit>) => {
      localStorage.setItem('unit.altitude', action.payload);
      state.altitude = action.payload;
    },
    setVarioUnit: (state, action: PayloadAction<SpeedUnit>) => {
      localStorage.setItem('unit.vario', action.payload);
      state.vario = action.payload;
    },
  },
});

export const reducer = unitsSlice.reducer;
export const { setDistanceUnit, setSpeedUnit, setAltitudeUnit, setVarioUnit } = unitsSlice.actions;
