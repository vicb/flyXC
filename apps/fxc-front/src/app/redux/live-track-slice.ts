import type { LatLonAlt, protos } from '@flyxc/common';
import { getLastMessage, isEmergencyTrack, isGroundAltitudeValid, LiveTrackDurationSec } from '@flyxc/common';
import type { EntityState, PayloadAction } from '@reduxjs/toolkit';
import { createAction, createAsyncThunk, createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';

import { isMobile } from '../logic/browser';
import { getFetchParameters } from '../logic/live-track';
import type { Response } from '../workers/live-track';
import LiveTrackWorker from '../workers/live-track?worker';
import type { RootState } from './store';

// Refresh live tracks every.
const REFRESH_INTERVAL_SEC = isMobile() ? 2 * 60 : 60;
/** Local storage key for the return URL (must be kept in sync with device-form.ts). */
export const RETURN_URL_KEY = 'url.tracking.return';

const trackAdapter = createEntityAdapter<protos.LiveTrack, string>({
  selectId: (track) => String(track.id ?? track.idStr),
});

export const liveTrackSelectors = trackAdapter.getSelectors((state: RootState) => state.liveTrack.tracks);
export const {
  selectIds: selectLiveTrackIds,
  selectEntities: selectLiveTrackEntities,
  selectAll: selectAllLiveTracks,
  selectTotal: selectLiveTrackTotal,
  selectById: selectLiveTrackById,
} = liveTrackSelectors;

export type TrackState = {
  tracks: EntityState<protos.LiveTrack, string>;
  // Fetch timestamp of the current data.
  fetchMillis: number;
  geojson: any;
  currentLiveId?: string;
  displayLabels: boolean;
  // Whether the map should be centered on the current location.
  // Only used when the live modal is opened.
  centerOnLocation: boolean;
  historySec: number;
};

const initialState: TrackState = {
  fetchMillis: 0,
  tracks: trackAdapter.getInitialState(),
  geojson: { type: 'FeatureCollection', features: [] },
  displayLabels: true,
  centerOnLocation: false,
  historySec: LiveTrackDurationSec.H12,
};

let refreshTimer: NodeJS.Timeout | number | undefined;

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
    setTracks: (state, action: PayloadAction<protos.LiveTrack[]>) => {
      trackAdapter.setAll(state.tracks, action);
    },
    setGeojson: (state, action: PayloadAction<any>) => {
      state.geojson = action.payload;
    },
    setFetchMillis: (state, action: PayloadAction<number>) => {
      state.fetchMillis = action.payload;
    },
    startRefreshTimer: () => {
      if (!refreshTimer && appStore) {
        refreshTimer = setInterval(() => appStore?.dispatch(updateTrackers() as any), REFRESH_INTERVAL_SEC * 1000);
      }
    },
    stopRefreshTimer: () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
    },
    setReturnUrl: (_state, _action: PayloadAction<string>) => {
      // Intentionally empty: side-effect is handled by the storage-sync listener middleware.
    },
    setCurrentLiveId: (state, action: PayloadAction<string | undefined>) => {
      state.currentLiveId = action.payload;
    },
    setHistorySec: (state, action: PayloadAction<number>) => {
      state.historySec = action.payload;
    },
  },
  selectors: {
    selectCurrentLiveId: (state) => state.currentLiveId,
    selectDisplayLabels: (state) => state.displayLabels,
    selectCenterOnLocation: (state) => state.centerOnLocation,
    selectHistorySec: (state) => state.historySec,
    selectFetchMillis: (state) => state.fetchMillis,
    selectGeojson: (state) => state.geojson,
  },
  extraReducers: (builder) => {
    // Automatically clear live track selection when a runtime track is selected,
    // enforcing store-level mutual exclusion between runtime and live tracks.
    builder.addCase(createAction<string | undefined>('track/setCurrentTrackId'), (state, action) => {
      if (action.payload != null) {
        state.currentLiveId = undefined;
      }
    });
  },
});

let appStore: { dispatch: (action: any) => void } | undefined;
let trackWorker: Worker | undefined;

/**
 * Initializes live tracking, setting up the background worker for track processing
 * and visibility change listeners.
 *
 * @param store - The Redux store or dispatch provider.
 */
export function initLiveTracking(store: { dispatch: (action: any) => void }): void {
  appStore = store;
  if (typeof Worker !== 'undefined') {
    if (!trackWorker) {
      trackWorker = new LiveTrackWorker();
    }
    trackWorker.onmessage = (msg: MessageEvent<Response>) => {
      store.dispatch(trackSlice.actions.setTracks(msg.data.tracks));
      store.dispatch(trackSlice.actions.setGeojson(msg.data.geojson));
    };
    handleVisibility();
    document.addEventListener('visibilitychange', () => handleVisibility());
  }
}

/**
 * Async thunk to fetch live tracking updates from the API server and pass them
 * to the web worker for decoding and GeoJSON feature generation.
 */
export const updateTrackers = createAsyncThunk('liveTrack/fetch', async (_: undefined, api) => {
  try {
    const state = (api.getState() as RootState).liveTrack;
    const nowMs = Date.now();
    const lastFetchAgeSec = (nowMs - state.fetchMillis) / 1000;
    const { fetchSec, isIncremental } = getFetchParameters(lastFetchAgeSec, state.historySec);
    const response = await fetch(`${import.meta.env.VITE_API_SERVER}/api/live/tracks.pbf?sec=${fetchSec}`);
    if (response.status === 200) {
      const tracks = state.tracks.entities;
      trackWorker?.postMessage({
        buffer: await response.arrayBuffer(),
        historySec: state.historySec,
        isIncremental,
        tracks,
      });
      api.dispatch(trackSlice.actions.setFetchMillis(nowMs));
    } else {
      response.body?.cancel?.();
    }
  } catch (e) {
    console.error(e);
  }
});

/**
 * Starts or stops live tracking updates according to document visibility.
 *
 * Pauses periodic polling when the tab is hidden to save bandwidth and battery.
 *
 * @param store - Optional Redux store reference.
 */
export function handleVisibility(store?: { dispatch: (action: any) => void }): void {
  if (store) {
    appStore = store;
  }
  if (!appStore) {
    return;
  }
  const visible = document.visibilityState == 'visible';
  if (visible) {
    appStore.dispatch(updateTrackers() as any);
    appStore.dispatch(trackSlice.actions.startRefreshTimer());
  } else {
    appStore.dispatch(trackSlice.actions.stopRefreshTimer());
  }
}

export const reducer = trackSlice.reducer;
export const { setReturnUrl, setCurrentLiveId, setDisplayLabels, setCenterOnLocation, setFetchMillis, setHistorySec } =
  trackSlice.actions;

export const {
  selectCurrentLiveId,
  selectDisplayLabels,
  selectCenterOnLocation,
  selectHistorySec,
  selectFetchMillis,
  selectGeojson,
} = trackSlice.selectors;

export type LivePilot = {
  id: string;
  name: string;
  position: LatLonAlt;
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
      id: String(track.id ?? track.idStr),
      name: track.name as string,
      position: {
        lat: track.lat[lastIndex],
        lon: track.lon[lastIndex],
        alt: track.alt[lastIndex],
      },
      gndAlt: isGroundAltitudeValid(track.gndAlt[lastIndex]) ? track.gndAlt[lastIndex] : undefined,
      speed: extra?.speed,
      timeSec: track.timeSec[lastIndex],
      isEmergency: isEmergencyTrack(track),
      message: getLastMessage(track),
    };
  });
});
