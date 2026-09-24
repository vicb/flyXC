import { Class, Type } from '@flyxc/common';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector, createSlice } from '@reduxjs/toolkit';

import { DistanceUnit } from '../logic/units';
import { selectAltitudeUnit } from './units-slice';

type AirspaceState = {
  maxAltitude: number;
  show: boolean;
  showClasses: Class[];
  showTypes: Type[];
};

let initClasses = [Class.A, Class.B, Class.C, Class.D, Class.E];

try {
  const classes = localStorage.getItem('airspaceClasses');
  if (classes) {
    initClasses = JSON.parse(classes);
  }
} catch (e) {
  // empty
}

let initTypes = [Type.Prohibited, Type.Restricted, Type.Danger];

try {
  const types = localStorage.getItem('airspaceTypes');
  if (types) {
    initTypes = JSON.parse(types);
  }
} catch (e) {
  // empty
}

const initialState: AirspaceState = {
  maxAltitude: 3000,
  show: false,
  showClasses: initClasses,
  showTypes: initTypes,
};

const airspaceSlice = createSlice({
  name: 'airspace',
  initialState,
  reducers: {
    /** Sets whether airspace boundaries are displayed on the map. */
    setShow: (state, action: PayloadAction<boolean>) => {
      state.show = action.payload;
    },
    /** Sets which airspace classes should be displayed. */
    showClasses: (state, action: PayloadAction<Class[]>) => {
      state.showClasses = action.payload;
    },
    /** Sets which airspace types (e.g. Danger, Restricted) should be displayed. */
    showTypes: (state, action: PayloadAction<Type[]>) => {
      state.showTypes = action.payload;
    },
    /** Sets the maximum altitude threshold for airspaces to display. */
    setMaxAltitude: (state, action: PayloadAction<number>) => {
      state.maxAltitude = action.payload;
    },
  },
  selectors: {
    selectShowAirspaces: (state) => state.show,
    selectShowClasses: (state) => state.showClasses,
    selectShowTypes: (state) => state.showTypes,
    selectMaxAltitude: (state) => state.maxAltitude,
  },
});

export const reducer = airspaceSlice.reducer;
export const { setMaxAltitude, setShow, showClasses, showTypes } = airspaceSlice.actions;
export const { selectShowAirspaces, selectShowClasses, selectShowTypes, selectMaxAltitude } = airspaceSlice.selectors;

/**
 * Returns a list of altitude stops for airspaces in meters, rounded according to the current altitude unit.
 */
export const selectAirspaceAltitudeStops = createSelector([selectAltitudeUnit], (altitudeUnit): number[] => {
  const steps: number[] = [];
  if (altitudeUnit === DistanceUnit.Feet) {
    for (let ft = 1000; ft <= 17000; ft += 1000) {
      const m = ft / 3.28084;
      steps.push(m);
    }
  } else {
    for (let m = 500; m <= 6000; m += 500) {
      steps.push(m);
    }
  }
  return steps;
});
