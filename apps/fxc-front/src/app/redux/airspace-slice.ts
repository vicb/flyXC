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
    setShow: (state, action: PayloadAction<boolean>) => {
      state.show = action.payload;
    },
    showClasses: (state, action: PayloadAction<Class[]>) => {
      state.showClasses = action.payload;
      localStorage.setItem('airspaceClasses', JSON.stringify(action.payload));
    },
    showTypes: (state, action: PayloadAction<Type[]>) => {
      localStorage.setItem('airspaceTypes', JSON.stringify(action.payload));
      state.showTypes = action.payload;
    },
    setMaxAltitude: (state, action: PayloadAction<number>) => {
      state.maxAltitude = action.payload;
    },
  },
});

export const reducer = airspaceSlice.reducer;
export const { setMaxAltitude, setShow, showClasses, showTypes } = airspaceSlice.actions;
