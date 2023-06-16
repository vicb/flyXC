import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ArcgisState = {
  // Altitude exaggeration multiplier for 3d.
  altMultiplier: number;
  useSunLighting: boolean;
};

const initialState: ArcgisState = {
  altMultiplier: 1.3,
  useSunLighting: true,
};

const arcgisSlice = createSlice({
  name: 'arcgis',
  initialState,
  reducers: {
    setAltitudeMultiplier: (state, action: PayloadAction<number>) => {
      state.altMultiplier = action.payload;
    },
    setUseSunLighting: (state, action: PayloadAction<boolean>) => {
      state.useSunLighting = action.payload;
    },
  },
});

export const reducer = arcgisSlice.reducer;
export const { setAltitudeMultiplier, setUseSunLighting } = arcgisSlice.actions;
