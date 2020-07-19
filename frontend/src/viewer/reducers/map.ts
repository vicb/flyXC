import cookies from 'cookiesjs';
import { Reducer } from 'redux';

import { RuntimeTrack } from '../../../../common/track';
import {
  ADD_TRACKS,
  CLOSE_ACTIVE_TRACK,
  CLOSE_TRACK_BY_ID,
  DECREMENT_SPEED,
  FETCH_METADATA,
  INCREMENT_SPEED,
  MapAction,
  RECEIVE_METADATA,
  SET_ALTITUDE_UNIT,
  SET_ASP_ALTITUDE,
  SET_ASP_SHOW_RESTRICTED,
  SET_CHART_Y,
  SET_CURRENT_TRACK,
  SET_DISPLAY_LIVE_NAMES,
  SET_DISPLAY_NAMES,
  SET_DISTANCE,
  SET_DISTANCE_UNIT,
  SET_FETCHING_METADATA,
  SET_LEAGUE,
  SET_LOADING,
  SET_MAP,
  SET_SCORE,
  SET_SPEED,
  SET_SPEED_UNIT,
  SET_TS,
  SET_VARIO_UNIT,
  ZOOM_TRACKS,
} from '../actions/map';
import { zoomTracks } from '../logic/map';
import { DropOutOfDateEntries, patchMetadata } from '../logic/metadata';
import { Score } from '../logic/score/scorer';
import { UNITS } from '../logic/units';
import * as mapSel from '../selectors/map';

// Units for distance, altitude, speed and vario.
export interface Units {
  distance: UNITS;
  altitude: UNITS;
  speed: UNITS;
  vario: UNITS;
}

export interface MapState {
  aspAltitude: number;
  aspShowRestricted: boolean;
  chartY: string;
  currentTrack: number;
  displayLiveNames: boolean;
  displayNames: boolean;
  distance: number;
  league: string;
  loading: boolean;
  map: google.maps.Map;
  metadata: {
    idStartedOn: { [id: number]: number };
    isFetching: boolean;
  };
  score: Score | null;
  speed: number;
  tracks: RuntimeTrack[];
  ts: number;
  units: Units;
}

const INITIAL_STATE: MapState = {
  aspAltitude: 1000,
  aspShowRestricted: true,
  chartY: 'alt',
  currentTrack: 0,
  displayLiveNames: true,
  displayNames: false,
  distance: 0,
  league: cookies('league') || 'xc',
  loading: false,
  map: (null as unknown) as google.maps.Map,
  metadata: {
    idStartedOn: {},
    isFetching: false,
  },
  score: null,
  speed: 20,
  tracks: [],
  ts: 0,
  units: {
    distance: cookies('unit.distance') || UNITS.kilometers,
    speed: cookies('unit.speed') || UNITS.kilometers_hour,
    altitude: cookies('unit.altitude') || UNITS.meters,
    vario: cookies('unit.vario') || UNITS.meters_second,
  },
};

const map: Reducer<MapState, MapAction> = (state: MapState = INITIAL_STATE, action: MapAction) => {
  switch (action.type) {
    case SET_MAP:
      return { ...state, map: action.payload.map };

    case ADD_TRACKS: {
      const ids = mapSel.trackIds(state);
      // Filter out duplicates.
      const tracks = action.payload.tracks.filter((track) => ids.indexOf(track.id ?? -1) < 0);
      const ts = state.tracks.length > 0 ? state.ts : tracks[0].fixes.ts[0];

      return {
        ...state,
        ts,
        tracks: [...state.tracks, ...tracks],
      };
    }

    case FETCH_METADATA: {
      const { tracks } = action.payload;
      const idStartedOn: { [id: number]: number } = {};
      tracks.forEach((track) => {
        if (track.id != null && track.id != -1 && track.groupIndex != null && !track.isPostProcessed) {
          idStartedOn[track.id] = Date.now();
        }
      });

      return {
        ...state,
        metadata: { ...state.metadata, idStartedOn: { ...state.metadata.idStartedOn, ...idStartedOn } },
      };
    }

    case RECEIVE_METADATA: {
      const idStartedOn: { [id: number]: number } = DropOutOfDateEntries(state.metadata.idStartedOn);
      const { metaTracks } = action.payload;
      let { tracks } = state;

      if (metaTracks != null && metaTracks.byteLength > 0) {
        tracks = patchMetadata(tracks, metaTracks, idStartedOn);
      }

      return { ...state, tracks, metadata: { ...state.metadata, idStartedOn } };
    }

    case SET_FETCHING_METADATA: {
      const { isFetching } = action.payload;
      return {
        ...state,
        metadata: { ...state.metadata, isFetching },
      };
    }

    case ZOOM_TRACKS: {
      const map = state.map;
      const minLat = mapSel.minLat(state);
      const minLon = mapSel.minLon(state);
      const maxLat = mapSel.maxLat(state);
      const maxLon = mapSel.maxLon(state);
      const maxAlt = mapSel.maxAlt(state);
      zoomTracks(map, minLat, minLon, maxLat, maxLon);
      return { ...state, aspAltitude: maxAlt };
    }

    case SET_TS: {
      const { ts } = action.payload;
      return { ...state, ts };
    }

    case SET_CURRENT_TRACK: {
      const { index } = action.payload;
      return { ...state, currentTrack: index };
    }

    case SET_ASP_ALTITUDE: {
      const { aspAltitude } = action.payload;
      return { ...state, aspAltitude };
    }

    case SET_ASP_SHOW_RESTRICTED: {
      const { aspShowRestricted } = action.payload;
      return { ...state, aspShowRestricted };
    }

    case CLOSE_ACTIVE_TRACK: {
      const tracks = [...state.tracks];
      tracks.splice(state.currentTrack, 1);
      const currentTrack = 0;
      const ts = tracks.length ? tracks[currentTrack].fixes.ts[0] : 0;
      return { ...state, tracks, currentTrack, ts };
    }

    case CLOSE_TRACK_BY_ID: {
      const { id } = action.payload;
      const tracks = state.tracks.filter((track) => track.id != id);
      // Set the first track as active when closing the active track.
      const currentTrack = state.tracks[state.currentTrack].id === id ? 0 : state.currentTrack;
      const ts = tracks.length ? tracks[currentTrack].fixes.ts[0] : 0;
      return { ...state, tracks, currentTrack, ts };
    }

    case SET_LOADING:
      const { loading } = action.payload;
      return { ...state, loading };

    case SET_CHART_Y: {
      const { y } = action.payload;
      return { ...state, chartY: y };
    }

    case SET_SCORE: {
      const { score } = action.payload;
      return { ...state, score };
    }

    case SET_DISTANCE: {
      const { distance } = action.payload;
      return { ...state, distance };
    }

    case INCREMENT_SPEED: {
      const { speed } = state;
      return { ...state, speed: Math.floor(speed + 1) };
    }

    case DECREMENT_SPEED: {
      const { speed } = state;
      return { ...state, speed: Math.max(1, Math.floor(speed - 1)) };
    }

    case SET_SPEED: {
      const { speed } = action.payload;
      return { ...state, speed: Math.max(1, speed) };
    }

    case SET_LEAGUE: {
      const { league } = action.payload;
      cookies({ league });
      return { ...state, league };
    }

    case SET_SPEED_UNIT: {
      const { unit } = action.payload;
      cookies({ 'unit.speed': unit });
      return { ...state, units: { ...state.units, speed: unit } };
    }

    case SET_DISTANCE_UNIT: {
      const { unit } = action.payload;
      cookies({ 'unit.distance': unit });
      return { ...state, units: { ...state.units, distance: unit } };
    }

    case SET_ALTITUDE_UNIT: {
      const { unit } = action.payload;
      cookies({ 'unit.altitude': unit });
      return { ...state, units: { ...state.units, altitude: unit } };
    }

    case SET_VARIO_UNIT: {
      const { unit } = action.payload;
      cookies({ 'unit.vario': unit });
      return { ...state, units: { ...state.units, vario: unit } };
    }

    case SET_DISPLAY_NAMES: {
      const { enabled } = action.payload;
      return { ...state, displayNames: enabled };
    }

    case SET_DISPLAY_LIVE_NAMES: {
      const { enabled } = action.payload;
      return { ...state, displayLiveNames: enabled };
    }

    default:
      return state;
  }
};

export default map;
