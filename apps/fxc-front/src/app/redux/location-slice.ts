import type { LatLon } from '@flyxc/common';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

type State = {
  // Current location and zoom level.
  location: LatLon;
  zoom: number;
  // Initial location (read-only).
  start: LatLon;
  // Location retrieved from the browser.
  geolocation?: LatLon;
  requestingLocation: boolean;
};

const start: LatLon = {
  lat: Number(localStorage.getItem('init.lat') ?? 45),
  lon: Number(localStorage.getItem('init.lon') ?? 2),
};

const initialState: State = {
  location: start,
  zoom: 11,
  // Start location (read-only).
  start,
  requestingLocation: false,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    /** Sets the current map center location. */
    setCurrentLocation: (state, action: PayloadAction<LatLon>) => {
      state.location = action.payload;
    },
    /** Sets the current map zoom level. */
    setCurrentZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    /** Sets the geolocation retrieved from the browser. */
    setGeolocation: (state, action: PayloadAction<LatLon>) => {
      state.geolocation = action.payload;
    },
    /** Sets whether browser geolocation is currently being requested. */
    setRequestingLocation: (state, action: PayloadAction<boolean>) => {
      state.requestingLocation = action.payload;
    },
  },
  selectors: {
    selectLocation: (state) => state.location,
    selectZoom: (state) => state.zoom,
    selectStartLocation: (state) => state.start,
    selectGeolocation: (state) => state.geolocation,
    selectRequestingLocation: (state) => state.requestingLocation,
  },
});

export const reducer = locationSlice.reducer;
export const { setCurrentLocation, setCurrentZoom, setGeolocation, setRequestingLocation } = locationSlice.actions;
export const { selectLocation, selectZoom, selectStartLocation, selectGeolocation, selectRequestingLocation } =
  locationSlice.selectors;
