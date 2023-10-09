import {
  addAirspaces,
  addGroundAltitude,
  createRuntimeTracks,
  createTrackId,
  extractGroupId,
  protos,
  RuntimeTrack,
} from '@flyxc/common';
import { createAsyncThunk, createEntityAdapter, createSlice, EntityState, PayloadAction } from '@reduxjs/toolkit';
import { addUrlParamValue, deleteUrlParamValue, ParamNames } from '../logic/history';
import * as msg from '../logic/messages';
import type { Response } from '../workers/track';
import TrackWorker from '../workers/track?worker';
import { setTimeSec } from './app-slice';
import { setPlannerEnabled, setPlannerRoute } from './planner-slice';
import { AppDispatch, AppThunk, RootState } from './store';

const FETCH_EVERY_SECONDS = 15;
export const FETCH_FOR_MINUTES = 3;

const trackAdapter = createEntityAdapter<RuntimeTrack>({
  sortComparer: (a, b) => a.timeSec[0] - b.timeSec[0],
});

export type TrackState = {
  currentTrackId?: string;
  fetching: boolean;
  metadata: {
    // Map from group ids to when we started fetching metadata.
    gIdToStart: { [id: string]: number };
    // True when fetching metadata is pending.
    // It is pending for FETCH_EVERY_SECONDS.
    fetchPending: boolean;
  };
  tracks: EntityState<RuntimeTrack, string>;
  displayLabels: boolean;
  // Whether to move the map to see the pilot.
  lockOnPilot: boolean;
  // Domain of the loaded tracks
  domain: string;
  // Whether we are done loading tracks
  loaded: boolean;
};

const initialState: TrackState = {
  currentTrackId: undefined,
  fetching: false,
  metadata: {
    gIdToStart: {},
    fetchPending: false,
  },
  tracks: trackAdapter.getInitialState(),
  displayLabels: false,
  lockOnPilot: localStorage.getItem('track.lock-pilot') !== 'false',
  domain: '',
  loaded: false,
};

// Thunk to set the timestamp and current id when the first track is loaded.
const addTracks =
  (tracks: RuntimeTrack[]): AppThunk =>
  (dispatch, getState) => {
    const state = getState().track;
    const hasTrack = state.tracks.ids.length > 0;
    trackAdapter.addMany(state.tracks, tracks);
    if (!hasTrack) {
      dispatch(setTimeSec(tracks[0].timeSec[0]));
      dispatch(setCurrentTrackId(tracks[0].id));
    }
  };

const fetchPendingServerMetadata = createAsyncThunk(
  'track/fetchMetadata',
  async (_: undefined, api) => {
    api.dispatch(trackSlice.actions.setFetchingMetadata(true));
    await new Promise((resolve) => setTimeout(resolve, FETCH_EVERY_SECONDS * 1000));
    api.dispatch(trackSlice.actions.timeoutPendingServerMetadata());
    const state = api.getState() as RootState;
    const groupIds = Object.keys(state.track.metadata.gIdToStart);
    let output: ArrayBuffer | undefined;
    api.dispatch(trackSlice.actions.setFetchingMetadata(false));
    if (groupIds.length) {
      try {
        const response = await fetch(`/api/track/metadata.pbf?ids=${groupIds.join(',')}`);
        // The server returns a 204 (No content) status code when the metadata is not ready.
        if (response.status == 200) {
          output = await response.arrayBuffer();
        }
      } catch (e) {
        // empty
      }
      api.dispatch(fetchPendingServerMetadata());
    }
    return output;
  },
  {
    condition: (_: undefined, api) => {
      // Only schedule a fetch when none is pending.
      const state = api.getState() as RootState;
      return !state.track.metadata.fetchPending;
    },
  },
);

// Lazily created worker for client side track processing.
let trackWorker: Worker | undefined;

function getTrackWorker(dispatch: AppDispatch): Worker {
  if (!trackWorker) {
    trackWorker = new TrackWorker();
    trackWorker.onmessage = (msg: MessageEvent<Response>) => {
      dispatch(trackSlice.actions.patchTrack(msg.data));
    };
  }
  return trackWorker;
}

type FetchTrackParams = {
  url: string;
  options?: RequestInit;
};

// Fetches a track group and an optional route.
//
// Triggers:
// - the track worker,
// - the server metadata request.
//
// Returns the tracks.
export const fetchTrack = createAsyncThunk('track/fetch', async (params: FetchTrackParams, api) => {
  const response = await fetch(params.url, params.options);
  const metaTracksAndRoute = await response.arrayBuffer();
  const groupIds = new Set<number>();
  const { metaTrackGroups, route } = protos.MetaTrackGroupsAndRoute.fromBinary(new Uint8Array(metaTracksAndRoute));
  const tracks = createRuntimeTracks(metaTrackGroups);

  for (const group of metaTrackGroups) {
    if (group.domain != null && group.domain != '') {
      api.dispatch(setTrackDomain(group.domain));
      break;
    }
  }

  if (route && route.alt.length > 0) {
    const coords = [];
    for (let i = 0; i < route.alt.length; i++) {
      coords.push(new google.maps.LatLng(route.lat[i], route.lon[i]));
    }
    api.dispatch(setPlannerRoute(google.maps.geometry.encoding.encodePath(coords)));
    api.dispatch(setPlannerEnabled(true));
  }

  tracks.forEach((track) => {
    const groupId = extractGroupId(track.id);
    groupIds.add(groupId);
    addUrlParamValue(ParamNames.groupId, String(groupId));
    // Trigger the worker post-processing.
    getTrackWorker(api.dispatch as any).postMessage(track);
    if (!track.isPostProcessed) {
      api.dispatch(trackSlice.actions.addPendingServerMetadata(groupId));
    }
  });
  // api.dispatch does not support thunk.
  (api.dispatch as any)(addTracks(tracks));
  api.dispatch(fetchPendingServerMetadata());
  return tracks;
});

const trackSlice = createSlice({
  name: 'track',
  initialState,
  reducers: {
    setDisplayLabels: (state, action: PayloadAction<boolean>) => {
      state.displayLabels = action.payload;
    },
    setLockOnPilot: (state, action: PayloadAction<boolean>) => {
      localStorage.setItem('track.lock-pilot', String(action.payload));
      state.lockOnPilot = action.payload;
    },
    removeTracksByGroupIds: (state, action: PayloadAction<number[]>) => {
      const groupIds = action.payload.map((v) => String(v));
      groupIds.forEach((groupId) => deleteUrlParamValue(ParamNames.groupId, groupId));
      const trackIds = state.tracks.ids.filter((id) => groupIds.some((groupId) => String(id).startsWith(groupId)));
      trackAdapter.removeMany(state.tracks, trackIds);
      if (state.tracks.ids.length == 0) {
        state.currentTrackId = undefined;
      } else if (state.currentTrackId != null) {
        if (state.tracks.ids.indexOf(state.currentTrackId) == -1) {
          state.currentTrackId = String(state.tracks.ids[0]);
        }
      }
    },
    setCurrentTrackId: (state, action: PayloadAction<string | undefined>) => {
      state.currentTrackId = action.payload;
    },
    setTrackLoaded: (state, action: PayloadAction<boolean>) => {
      state.loaded = action.payload;
    },
    setTrackDomain: (state, action: PayloadAction<string>) => {
      state.domain = action.payload;
    },
    selectNextTrack: (state) => {
      if (state.currentTrackId != null && state.tracks.ids.length > 0) {
        const index = state.tracks.ids.indexOf(state.currentTrackId);
        state.currentTrackId = String(state.tracks.ids[(index + 1) % state.tracks.ids.length]);
      }
    },
    patchTrack: (state, action: PayloadAction<Partial<RuntimeTrack> & Pick<RuntimeTrack, 'id'>>) => {
      const update = action.payload;
      trackAdapter.updateOne(state.tracks, {
        id: update.id,
        changes: update,
      });
    },
    setFetchingMetadata: (state, action: PayloadAction<boolean>) => {
      state.metadata.fetchPending = action.payload;
    },
    // Add a group id to the schedule.
    addPendingServerMetadata: (state, action: PayloadAction<number>) => {
      const groupId = action.payload;
      if (!(groupId in state.metadata.gIdToStart)) {
        state.metadata.gIdToStart[groupId] = Date.now();
      }
    },
    // Remove old requests that haven't been fulfilled.
    timeoutPendingServerMetadata: (state) => {
      const groupIdToStart = state.metadata.gIdToStart;
      const dropBefore = Date.now() - FETCH_FOR_MINUTES * 60 * 1000;
      for (const [id, startedOn] of Object.entries(groupIdToStart)) {
        if (startedOn <= dropBefore) {
          delete groupIdToStart[id];
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrack.pending, (state) => {
        state.fetching = true;
      })
      .addCase(fetchTrack.fulfilled, (state, action: PayloadAction<RuntimeTrack[]>) => {
        state.fetching = false;
        trackAdapter.addMany(state.tracks, action);

        const groupIds = new Set<number>();
        for (const track of action.payload) {
          groupIds.add(extractGroupId(track.id));
        }
        // Only emit the message after the reducer is done to avoid reentrancy.
        Promise.resolve().then(() => msg.trackGroupsAdded.emit(Array.from(groupIds)));
      })
      .addCase(fetchTrack.rejected, (state) => {
        state.fetching = false;
      })
      .addCase(fetchPendingServerMetadata.fulfilled, (state, action: PayloadAction<ArrayBuffer | undefined>) => {
        state.metadata.fetchPending = false;
        const metaTracks = action.payload;
        if (metaTracks) {
          // Decode the meta groups.
          const metaGroups: protos.MetaTrackGroup[] = protos.MetaTracks.fromBinary(
            new Uint8Array(metaTracks),
          ).metaTrackGroupsBin.map((metaGroupBin) => protos.MetaTrackGroup.fromBinary(metaGroupBin));

          // Patch any tack from the meta groups.
          metaGroups.forEach((metaGroup) => {
            const groupId = metaGroup.id;
            delete state.metadata.gIdToStart[groupId];
            // Patch the ground altitude.
            if (metaGroup.groundAltitudeGroupBin) {
              const gndAltitudes = protos.GroundAltitudeGroup.fromBinary(
                metaGroup.groundAltitudeGroupBin,
              ).groundAltitudes;

              gndAltitudes.forEach((gndAlt, index) => {
                const id = createTrackId(groupId, index);
                const track = state.tracks.entities[id];
                if (track != null) {
                  addGroundAltitude(track, gndAlt);
                }
              });
            }
            // Patch the airspaces.
            if (metaGroup.airspacesGroupBin) {
              const airspaces = protos.AirspacesGroup.fromBinary(metaGroup.airspacesGroupBin).airspaces;
              airspaces.forEach((asp, index) => {
                const id = createTrackId(groupId, index);
                const track = state.tracks.entities[id];
                if (track != null) {
                  addAirspaces(track, asp);
                }
              });
            }
          });
        }
      });
  },
});

export const reducer = trackSlice.reducer;
export const {
  removeTracksByGroupIds,
  setCurrentTrackId,
  selectNextTrack,
  setDisplayLabels,
  setLockOnPilot,
  setTrackDomain,
  setTrackLoaded,
} = trackSlice.actions;
export const trackAdapterSelector = trackAdapter.getSelectors((state: RootState) => state.track.tracks);
