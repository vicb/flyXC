import { LatLon } from 'flyxc/common/src/runtime-track';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CurrentLocation = {
  latLon: LatLon;
  zoom: number;
};

type State = {
  // current location, used to sync 2D and 3D map.
  current?: CurrentLocation;
  // Initial location (read-only).
  start: LatLon;
  // Location retrieved from the browser.
  geolocation?: LatLon;
};

const initialState: State = {
  // Start location (read-only).
  start: {
    lat: Number(localStorage.getItem('init.lat') ?? 45),
    lon: Number(localStorage.getItem('init.lon') ?? 2),
  },
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: {
      reducer: (state, action: PayloadAction<CurrentLocation>) => {
        state.current = action.payload;
      },
      prepare: (latLon: LatLon, zoom: number) => ({
        payload: { latLon, zoom },
      }),
    },
    setGeolocation: (state, action: PayloadAction<LatLon>) => {
      // The next initial location will be here.
      const latLon = action.payload;
      localStorage.setItem('init.lat', String(latLon.lat));
      localStorage.setItem('init.lon', String(latLon.lon));
      state.geolocation = latLon;
    },
  },
});

export const reducer = locationSlice.reducer;
export const { setCurrentLocation, setGeolocation } = locationSlice.actions;
