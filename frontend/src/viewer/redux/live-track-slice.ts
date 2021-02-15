import { LiveTrack } from 'flyxc/common/protos/live-track';
import { getLastMessage, isEmergencyTrack } from 'flyxc/common/src/live-track';
import { LatLonZ } from 'flyxc/common/src/runtime-track';

import {
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  createSlice,
  EntityState,
  PayloadAction,
} from '@reduxjs/toolkit';

import * as TrackWorker from '../workers/live-track';
import { RootState, store } from './store';

// Refresh live tracks every.
const REFRESH_INTERVAL_SEC = 2 * 60;
// Local storage key for the return URL.
// Must be kept in sync with device-form.ts.
const RETURN_URL_KEY = 'url.tracking.return';

const trackAdapter = createEntityAdapter<LiveTrack>({
  selectId: (track) => track.id as number,
});

export const liveTrackSelectors = trackAdapter.getSelectors((state: RootState) => state.liveTrack.tracks);

export type TrackState = {
  tracks: EntityState<LiveTrack>;
  // Fetch timestamp of the current data.
  timestamp: number;
  geojson: any;
  refreshTimer: any;
  currentLiveId?: number;
  displayLabels: boolean;
  // Whether the map should be centered on the current location.
  // Only used when the live modal is opened.
  centerOnLocation: boolean;
};

const initialState: TrackState = {
  timestamp: 0,
  tracks: trackAdapter.getInitialState(),
  geojson: { type: 'FeatureCollection', features: [] },
  refreshTimer: undefined,
  displayLabels: true,
  centerOnLocation: false,
};

const trackSlice = createSlice({
  name: 'liveTrack',
  initialState,
  reducers: {
    setCenterOnLocation: (state, action: PayloadAction<boolean>) => {
      state.centerOnLocation = action.payload;
    },
    setDisplayLabels: (state, action: PayloadAction<boolean>) => {
      state.displayLabels = action.payload;
    },
    setTracks: (state, action: PayloadAction<LiveTrack[]>) => {
      trackAdapter.setAll(state.tracks, action);
    },
    setGeojson: (state, action: PayloadAction<any>) => {
      state.geojson = action.payload;
    },
    setTimestamp: (state, action: PayloadAction<number>) => {
      state.timestamp = action.payload;
    },
    startRefreshTimer: (state) => {
      if (!state.refreshTimer) {
        state.refreshTimer = setInterval(() => store.dispatch(updateTrackers()), REFRESH_INTERVAL_SEC * 1000);
      }
    },
    stopRefreshTimer: (state) => {
      if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
        state.refreshTimer = null;
      }
    },
    setReturnUrl: (state, action: PayloadAction<string>) => {
      localStorage.setItem(RETURN_URL_KEY, action.payload);
    },
    setCurrentLiveId: (state, action: PayloadAction<number | undefined>) => {
      state.currentLiveId = action.payload;
    },
  },
});

const trackWorker = new Worker('js/workers/live-track.js');
trackWorker.onmessage = (msg: MessageEvent<TrackWorker.Response>) => {
  store.dispatch(trackSlice.actions.setTracks(msg.data.tracks));
  store.dispatch(trackSlice.actions.setGeojson(msg.data.geojson));
};

const updateTrackers = createAsyncThunk('liveTrack/fetch', async (_: undefined, api) => {
  const fetchTimestamp = Date.now();
  try {
    const time = Math.round(((api.getState() as RootState).liveTrack.timestamp ?? 0) / 1000);
    const response = await fetch(`_livetracks?s=${time}`);
    if (response.status == 200) {
      const tracks = (api.getState() as RootState).liveTrack.tracks.entities;
      trackWorker.postMessage({
        buffer: await response.arrayBuffer(),
        tracks,
      });
      api.dispatch(trackSlice.actions.setTimestamp(fetchTimestamp));
    }
  } catch (e) {
    console.error(e);
  }
});

export function handleVisibility(): void {
  const visible = document.visibilityState == 'visible';
  if (visible) {
    store.dispatch(updateTrackers());
    store.dispatch(trackSlice.actions.startRefreshTimer());
  } else {
    store.dispatch(trackSlice.actions.stopRefreshTimer());
  }
}

// The timer should only be active when the app is visible.
document.addEventListener('visibilitychange', handleVisibility);

export const reducer = trackSlice.reducer;
export const { setReturnUrl, setCurrentLiveId, setDisplayLabels, setCenterOnLocation } = trackSlice.actions;

export type LivePilot = {
  id: number;
  name: string;
  position: LatLonZ;
  gndAlt?: number;
  speed?: number;
  timeSec: number;
  // Last message along the track.
  message?: {
    text: string;
    timeSec: number;
  };
  // Whether there is an emergency.
  isEmergency: boolean;
};

export const getLivePilots = createSelector(liveTrackSelectors.selectAll, (tracks): LivePilot[] => {
  return tracks.map((track) => {
    const lastIndex = track.timeSec.length - 1;
    const extra = track.extra[lastIndex];
    return {
      id: track.id as number,
      name: track.name as string,
      position: {
        lat: track.lat[lastIndex],
        lon: track.lon[lastIndex],
        alt: track.alt[lastIndex],
      },
      gndAlt: extra?.gndAlt,
      speed: extra?.speed,
      timeSec: track.timeSec[lastIndex],
      isEmergency: isEmergencyTrack(track),
      message: getLastMessage(track),
    };
  });
});
