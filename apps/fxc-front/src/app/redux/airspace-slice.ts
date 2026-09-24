import { Class, Type } from '@flyxc/common';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

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
