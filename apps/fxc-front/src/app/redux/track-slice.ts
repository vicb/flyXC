import type { LatLon, RuntimeTrack } from '@flyxc/common';
import {
  addAirspaces,
  addGroundAltitude,
  arrayMax,
  arrayMin,
  createRuntimeTracks,
  createTrackId,
  extractGroupId,
  protos,
} from '@flyxc/common';
import type { EntityState, PayloadAction } from '@reduxjs/toolkit';
import { createAction, createAsyncThunk, createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';

import { addUrlParamValue, ParamNames } from '../logic/history';
import * as msg from '../logic/messages';
import { getUniqueColor } from '../styles/track';
import type { Response } from '../workers/track';
import TrackWorker from '../workers/track?worker';
import { setTimeSec } from './app-slice';
import { setEnabled, setRoute } from './planner-slice';
import type { AppDispatch, AppThunk, RootState } from './store';

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
        const response = await fetch(
          `${import.meta.env.VITE_API_SERVER}/api/track/metadata.pbf?ids=${groupIds.join(',')}`,
        );
        // The server returns a 204 (No content) status code when the metadata is not ready.
        if (response.status === 200) {
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
    api.dispatch(setRoute(google.maps.geometry.encoding.encodePath(coords)));
    api.dispatch(setEnabled(true));
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
      state.lockOnPilot = action.payload;
    },
    removeTracksByGroupIds: (state, action: PayloadAction<number[]>) => {
      const groupIds = action.payload.map((v) => String(v));
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
    addTrackEntities: (state, action: PayloadAction<RuntimeTrack[]>) => {
      trackAdapter.addMany(state.tracks, action.payload);
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
    // Automatically clear runtime track selection when a live track is selected,
    // enforcing store-level mutual exclusion between runtime and live tracks.
    builder
      .addCase(createAction<string | undefined>('liveTrack/setCurrentLiveId'), (state, action) => {
        if (action.payload != null) {
          state.currentTrackId = undefined;
        }
      })
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
  selectors: {
    selectCurrentTrackId: (state) => state.currentTrackId,
    selectFetching: (state) => state.fetching,
    selectDisplayLabels: (state) => state.displayLabels,
    selectLockOnPilot: (state) => state.lockOnPilot,
    selectDomain: (state) => state.domain,
    selectLoaded: (state) => state.loaded,
  },
});

export const reducer = trackSlice.reducer;
export const {
  addTrackEntities,
  removeTracksByGroupIds,
  setCurrentTrackId,
  setDisplayLabels,
  setLockOnPilot,
  setTrackDomain,
  setTrackLoaded,
} = trackSlice.actions;

export const {
  selectCurrentTrackId,
  selectFetching,
  selectDisplayLabels,
  selectLockOnPilot,
  selectDomain,
  selectLoaded,
} = trackSlice.selectors;

/**
 * Selects the next runtime track in the list.
 *
 * If no runtime track is currently selected, selects the first track.
 * Dispatches setCurrentTrackId only if there is at least one runtime track,
 * which clears any live track selection. If no runtime tracks exist,
 * does not dispatch or change selection.
 */
export const selectNextTrack = (): AppThunk => (dispatch, getState) => {
  const state = getState().track;
  if (state.tracks.ids.length > 0) {
    if (state.currentTrackId == null) {
      dispatch(setCurrentTrackId(String(state.tracks.ids[0])));
    } else {
      const index = state.tracks.ids.indexOf(state.currentTrackId);
      dispatch(setCurrentTrackId(String(state.tracks.ids[(index + 1) % state.tracks.ids.length])));
    }
  }
};

export const trackAdapterSelector = trackAdapter.getSelectors((state: RootState) => state.track.tracks);
export const {
  selectIds: selectTrackIds,
  selectEntities: selectTrackEntities,
  selectAll: selectAllTracks,
  selectTotal: selectTrackTotal,
  selectById: selectTrackById,
} = trackAdapterSelector;

/**
 * Selects the currently selected RuntimeTrack object, or undefined if none is selected.
 */
export const selectCurrentTrack = createSelector(
  [selectCurrentTrackId, selectTrackEntities],
  (trackId, entities): RuntimeTrack | undefined => (trackId && entities ? entities[trackId] : undefined),
);

/**
 * Returns a Set of group IDs present across all loaded tracks.
 */
export const selectGroupIds = createSelector(
  [selectTrackIds],
  (ids): Set<number> => new Set(ids.map((trackId) => extractGroupId(String(trackId)))),
);

/**
 * True if loaded tracks' start times are more than 12h apart.
 */
export const selectIsMultiDay = createSelector([selectAllTracks], (tracks): boolean => {
  if (tracks.length === 0) {
    return false;
  }
  const startTimesSec = tracks.map((t) => t.minTimeSec);
  const minTimeSec = arrayMin(startTimesSec);
  const maxTimeSec = arrayMax(startTimesSec);
  return maxTimeSec - minTimeSec > 12 * 3600;
});

/**
 * Offsets to subtract from each track timestamp to normalize multi-day tracks to the start of the current track.
 */
export const selectOffsetSeconds = createSelector(
  [selectAllTracks, selectCurrentTrack, selectIsMultiDay],
  (tracks, currentTrack, isMultiDay): { [id: string]: number } => {
    const offsets: { [id: string]: number } = {};
    if (tracks.length > 0) {
      const referenceTrack = currentTrack ?? tracks[0];
      const start = referenceTrack.timeSec[0];
      tracks.forEach((track) => {
        offsets[track.id] = isMultiDay ? track.timeSec[0] - start : 0;
      });
    }
    return offsets;
  },
);

export const selectMaxLats = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.maxLat));
export const selectMaxLat = createSelector([selectMaxLats], (lats) => arrayMax(lats));

export const selectMaxLons = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.maxLon));
export const selectMaxLon = createSelector([selectMaxLons], (lons) => arrayMax(lons));

export const selectMinLats = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.minLat));
export const selectMinLat = createSelector([selectMinLats], (lats) => arrayMin(lats));

export const selectMinLons = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.minLon));
export const selectMinLon = createSelector([selectMinLons], (lons) => arrayMin(lons));

export const selectMaxTimeSecs = createSelector([selectAllTracks, selectOffsetSeconds], (tracks, offsetSeconds) =>
  tracks.map((t) => t.maxTimeSec - (offsetSeconds[t.id] ?? 0)),
);
export const selectMaxTimeSec = createSelector([selectMaxTimeSecs], (timeSecs) =>
  timeSecs.length ? arrayMax(timeSecs) : 1,
);

export const selectMinTimeSecs = createSelector([selectAllTracks, selectOffsetSeconds], (tracks, offsetSeconds) =>
  tracks.map((t) => t.minTimeSec - (offsetSeconds[t.id] ?? 0)),
);
export const selectMinTimeSec = createSelector([selectMinTimeSecs], (timeSecs) =>
  timeSecs.length ? arrayMin(timeSecs) : 0,
);

export const selectMaxAlts = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.maxAlt));
export const selectMaxAlt = createSelector([selectMaxAlts], (alts) => arrayMax(alts, 0));

export const selectMinAlts = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.minAlt));
export const selectMinAlt = createSelector([selectMinAlts], (alts) => arrayMin(alts));

export const selectMaxSpeeds = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.maxVx));
export const selectMaxSpeed = createSelector([selectMaxSpeeds], (speeds) => arrayMax(speeds));

export const selectMinSpeeds = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.minVx));
export const selectMinSpeed = createSelector([selectMinSpeeds], (speeds) => arrayMin(speeds));

export const selectMaxVarios = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.maxVz));
export const selectMaxVario = createSelector([selectMaxVarios], (varios) => arrayMax(varios));

export const selectMinVarios = createSelector([selectAllTracks], (tracks) => tracks.map((t) => t.minVz));
export const selectMinVario = createSelector([selectMinVarios], (varios) => arrayMin(varios));

/**
 * Returns the geographical bounding box of all loaded tracks, or null if no tracks are loaded.
 */
export const selectTracksExtent = createSelector(
  [selectAllTracks, selectMinLat, selectMinLon, selectMaxLat, selectMaxLon],
  (tracks, minLat, minLon, maxLat, maxLon): { ne: LatLon; sw: LatLon } | null => {
    if (tracks.length === 0) {
      return null;
    }
    return {
      ne: { lat: maxLat, lon: maxLon },
      sw: { lat: minLat, lon: minLon },
    };
  },
);

/**
 * Maps each track ID to a distinct display color.
 */
export const selectTrackColors = createSelector([selectTrackIds], (ids): { [id: string]: string } => {
  const colors: { [id: string]: string } = {};
  ids.forEach((id, i) => {
    colors[id] = getUniqueColor(String(i), 1);
  });
  return colors;
});
