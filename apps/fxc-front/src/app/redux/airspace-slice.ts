import { Class, Type } from '@flyxc/common';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';

type AirspaceState = {
  maxAltitude: number;
  show: boolean;
  showClasses: Class[];
  showTypes: Type[];
};

const initialState: AirspaceState = {
  maxAltitude: 3000,
  show: false,
  showClasses: [Class.A, Class.B, Class.C, Class.D, Class.E],
  showTypes: [Type.Prohibited, Type.Restricted, Type.Danger],
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
    },
    showTypes: (state, action: PayloadAction<Type[]>) => {
      state.showTypes = action.payload;
    },
    setMaxAltitude: (state, action: PayloadAction<number>) => {
      state.maxAltitude = action.payload;
    },
  },
});

export const reducer = airspaceSlice.reducer;
export const { setMaxAltitude, setShow, showClasses, showTypes } = airspaceSlice.actions;
