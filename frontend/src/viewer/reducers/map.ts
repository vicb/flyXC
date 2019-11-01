import * as mapSel from '../selectors/map';

import {
  ADD_TRACKS,
  CLOSE_ACTIVE_TRACK,
  DECREMENT_SPEED,
  INCREMENT_SPEED,
  MapAction,
  SET_ALTITUDE_UNIT,
  SET_ASP_ALTITUDE,
  SET_CHART_Y,
  SET_CURRENT_TRACK,
  SET_DISTANCE,
  SET_DISTANCE_UNIT,
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
import { Track, createTracks, zoomTracks } from '../logic/map';

import { Reducer } from 'redux';
import { Score } from '../logic/score/scorer';
import { UNITS } from '../logic/units';
import cookies from 'cookiesjs';

export interface MapState {
  map: google.maps.Map;
  tracks: Track[];
  ts: number;
  currentTrack: number;
  aspAltitude: number;
  loading: boolean;
  chartY: string;
  score: Score | null;
  distance: number;
  speed: number;
  league: string;
  units: {
    distance: string;
    altitude: string;
    speed: string;
    vario: string;
  };
}

const INITIAL_STATE: MapState = {
  map: (null as unknown) as google.maps.Map,
  tracks: [],
  ts: 0,
  currentTrack: 0,
  aspAltitude: 1,
  loading: false,
  chartY: 'alt',
  score: null,
  distance: 0,
  speed: 20,
  league: cookies('league') || 'xc',
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
      const tracks = createTracks(action.payload.buffer);

      return {
        ...state,
        tracks: [...state.tracks, ...tracks],
      };
    }

    case ZOOM_TRACKS: {
      const map = state.map;
      const minLat = mapSel.minLat(state);
      const minLon = mapSel.minLon(state);
      const maxLat = mapSel.maxLat(state);
      const maxLon = mapSel.maxLon(state);
      zoomTracks(map, minLat, minLon, maxLat, maxLon);
      return state;
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

    case CLOSE_ACTIVE_TRACK: {
      const tracks = [...state.tracks];
      tracks.splice(state.currentTrack, 1);
      const currentTrack = 0;
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

    default:
      return state;
  }
};

export default map;
