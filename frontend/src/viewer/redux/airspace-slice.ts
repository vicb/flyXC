import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AirspaceState = {
  maxAltitude: number;
  show: boolean;
  showRestricted: boolean;
  onGraph: string[];
};

const initialState: AirspaceState = {
  maxAltitude: 1000,
  show: false,
  showRestricted: true,
  onGraph: [],
};

const airspaceSlice = createSlice({
  name: 'airspace',
  initialState,
  reducers: {
    setShow: (state, action: PayloadAction<boolean>) => {
      state.show = action.payload;
    },
    setShowRestricted: (state, action: PayloadAction<boolean>) => {
      state.showRestricted = action.payload;
    },
    setAirspacesOnGraph: (state, action: PayloadAction<string[]>) => {
      state.onGraph = action.payload;
    },
    setMaxAltitude: (state, action: PayloadAction<number>) => {
      state.maxAltitude = action.payload;
    },
  },
});

export const reducer = airspaceSlice.reducer;
export const { setMaxAltitude, setShow, setShowRestricted, setAirspacesOnGraph } = airspaceSlice.actions;
