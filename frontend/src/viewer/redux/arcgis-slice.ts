import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import type ElevationSampler from 'esri/layers/support/ElevationSampler';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Api } from '../logic/arcgis';

type ArcgisState = {
  // Altitude exaggeration multiplier for 3d.
  altMultiplier: number;
  // Pilots, tracks, ...
  graphicsLayer?: GraphicsLayer;
  // Graphics layer with elevation mode "on-the-ground" for shadows.
  gndGraphicsLayer?: GraphicsLayer;
  api?: Api;
  // Sample ground elevation in the SceneView (takes the exaggeration into account).
  elevationSampler?: ElevationSampler;
};

const initialState: ArcgisState = {
  altMultiplier: 1,
};

const arcgisSlice = createSlice({
  name: 'arcgis',
  initialState,
  reducers: {
    setApi: (state, action: PayloadAction<Api | undefined>) => {
      state.api = action.payload;
    },
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
  },
});

export const reducer = arcgisSlice.reducer;
export const {
  setAltitudeMultiplier,
  setApi,
  setElevationSampler,
  setGraphicsLayer,
  setGndGraphicsLayer,
} = arcgisSlice.actions;
