import { LatLon } from '@flyxc/common';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    setCurrentLocation: (state, action: PayloadAction<LatLon>) => {
      state.location = action.payload;
    },
    setCurrentZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    setGeolocation: (state, action: PayloadAction<LatLon>) => {
      // The next initial location will be here.
      const latLon = action.payload;
      localStorage.setItem('init.lat', String(latLon.lat));
      localStorage.setItem('init.lon', String(latLon.lon));
      state.geolocation = latLon;
    },
    setRequestingLocation: (state, action: PayloadAction<boolean>) => {
      state.requestingLocation = action.payload;
    },
  },
});

export const reducer = locationSlice.reducer;
export const { setCurrentLocation, setCurrentZoom, setGeolocation, setRequestingLocation } = locationSlice.actions;
