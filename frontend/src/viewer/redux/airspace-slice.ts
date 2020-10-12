import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AirspaceState = {
  showRestricted: boolean;
  onGraph: string[];
};

const initialState: AirspaceState = {
  showRestricted: true,
  onGraph: [],
};

const airspaceSlice = createSlice({
  name: 'airspace',
  initialState,
  reducers: {
    setShowRestrictedAirspace: (state, action: PayloadAction<boolean>) => {
      state.showRestricted = action.payload;
    },
    setAirspacesOnGraph: (state, action: PayloadAction<string[]>) => {
      state.onGraph = action.payload;
    },
  },
});

export const reducer = airspaceSlice.reducer;
export const { setShowRestrictedAirspace, setAirspacesOnGraph } = airspaceSlice.actions;
