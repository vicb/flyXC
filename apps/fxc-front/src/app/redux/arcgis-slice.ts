import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ArcgisState = {
  // Altitude exaggeration multiplier for 3d.
  altMultiplier: number;
  // Pilots, tracks, ...
  graphicsLayer?: GraphicsLayer;
  // Graphics layer with elevation mode "on-the-ground" for shadows.
  gndGraphicsLayer?: GraphicsLayer;
  // Sample ground elevation in the SceneView (takes the exaggeration into account).
  elevationSampler?: ElevationSampler;
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
    setGraphicsLayer: (state, action: PayloadAction<GraphicsLayer | undefined>) => {
      state.graphicsLayer = action.payload;
    },
    setGndGraphicsLayer: (state, action: PayloadAction<GraphicsLayer | undefined>) => {
      state.gndGraphicsLayer = action.payload;
    },
    setAltitudeMultiplier: (state, action: PayloadAction<number>) => {
      state.altMultiplier = action.payload;
    },
    setElevationSampler: (state, action: PayloadAction<ElevationSampler | undefined>) => {
      state.elevationSampler = action.payload;
    },
    setUseSunLighting: (state, action: PayloadAction<boolean>) => {
      state.useSunLighting = action.payload;
    },
  },
});

export const reducer = arcgisSlice.reducer;
export const { setAltitudeMultiplier, setElevationSampler, setGraphicsLayer, setGndGraphicsLayer, setUseSunLighting } =
  arcgisSlice.actions;
