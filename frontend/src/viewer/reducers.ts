import cookies from 'cookiesjs';
import { Reducer } from 'redux';

import { LatLon, RuntimeTrack } from '../../../common/track';
import {
  ADD_TRACKS,
  DECREMENT_SPEED,
  FETCH_METADATA,
  INCREMENT_SPEED,
  MapAction,
  RECEIVE_METADATA,
  RECEIVE_TRACK_WORKER_RESP,
  REMOVE_TRACKS_BY_ID,
  SET_ALTITUDE_MULTIPLIER,
  SET_ALTITUDE_UNIT,
  SET_API_LOADING,
  SET_ASP_ALTITUDE,
  SET_ASP_SHOW_RESTRICTED,
  SET_CENTER_MAP,
  SET_CHART_AIRSPACES,
  SET_CHART_Y_AXIS,
  SET_CURRENT_LOCATION,
  SET_CURRENT_TRACK,
  SET_DISPLAY_LIVE_NAMES,
  SET_DISPLAY_NAMES,
  SET_DISTANCE,
  SET_DISTANCE_UNIT,
  SET_FETCHING_METADATA,
  SET_FULL_SCREEN,
  SET_GEOLOC,
  SET_LEAGUE,
  SET_SCORE,
  SET_SPEED,
  SET_SPEED_UNIT,
  SET_TIMESTAMP,
  SET_TRACK_LOADING,
  SET_VARIO_UNIT,
  SET_VIEW_3D,
} from './actions';
import { has3dUrlParam } from './logic/history';
import { DropOutOfDateEntries, patchMetadataFromServer } from './logic/metadata';
import { Score } from './logic/score/scorer';
import { UNITS } from './logic/units';
import * as sel from './selectors';

// Units for distance, altitude, speed and vario.
export interface Units {
  distance: UNITS;
  altitude: UNITS;
  speed: UNITS;
  vario: UNITS;
}

// Y axis of the chart.
export const enum ChartYAxis {
  Altitude,
  Speed,
  Vario,
}

export interface MapState {
  // Altitude exaggeration multiplier for 3d.
  altMultiplier: number;
  aspAltitude: number;
  aspShowRestricted: boolean;
  // Wether to center the map on the pilot location.
  centerMap: boolean;
  chart: {
    yAxis: ChartYAxis;
    ts: number;
    airspaces: string[];
  };
  currentTrackIndex: number;
  // Display pilot labels for live tracks.
  displayLiveNames: boolean;
  // Display pilot labels for tracks.
  displayNames: boolean;
  distance: number;
  fullscreen: boolean;
  // Running on a mobile ?
  isMobile: boolean;
  league: string;
  loadingApi: boolean;
  loadingTracks: boolean;
  location: {
    // current location, used to sync 2D and 3D map.
    current?: {
      latLon: LatLon;
      zoom: number;
    };
    // Initial location (read-only).
    start: LatLon;
    // Location retrieved from the browser.
    geoloc?: LatLon;
  };
  metadata: {
    // Map from track id to when we started fetching metadata.
    idStartedOn: { [id: number]: number };
    // Whether we are currently periodically fetching metadata.
    isFetching: boolean;
  };
  score: Score | null;
  speed: number;
  tracks: RuntimeTrack[];
  ts: number;
  units: Units;
  view3d: boolean;
}

const INITIAL_STATE: MapState = {
  altMultiplier: 1,
  aspAltitude: 1000,
  aspShowRestricted: true,
  centerMap: true,
  chart: {
    yAxis: ChartYAxis.Altitude,
    ts: 0,
    airspaces: [],
  },
  currentTrackIndex: 0,
  displayLiveNames: true,
  displayNames: false,
  distance: 0,
  fullscreen: false,
  // https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent),
  league: cookies('league') || 'xc',
  loadingApi: false,
  loadingTracks: false,
  location: {
    // Start location (read-only).
    start: {
      lat: (cookies('init.lat') as number) ?? 45,
      lon: (cookies('init.lon') as number) ?? 2,
    },
  },
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
  view3d: has3dUrlParam(),
};

const map: Reducer<MapState, MapAction> = (state: MapState = INITIAL_STATE, action: MapAction) => {
  switch (action.type) {
    case ADD_TRACKS: {
      const ids = sel.trackIds(state);
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
        tracks = patchMetadataFromServer(tracks, metaTracks, idStartedOn);
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

    case SET_TIMESTAMP: {
      const { ts } = action.payload;
      return { ...state, ts };
    }

    case SET_CURRENT_TRACK:
      return { ...state, currentTrackIndex: action.payload.index };

    case SET_ASP_ALTITUDE: {
      const { aspAltitude } = action.payload;
      return { ...state, aspAltitude };
    }

    case SET_ASP_SHOW_RESTRICTED: {
      const { aspShowRestricted } = action.payload;
      return { ...state, aspShowRestricted };
    }

    case REMOVE_TRACKS_BY_ID: {
      const { ids } = action.payload;
      const tracks = state.tracks.filter((track) => ids.indexOf(track.id ?? 0) < 0);
      // Set the first track as active when closing the active track.
      const nextIndex = ids.indexOf(state.tracks[state.currentTrackIndex].id ?? 0) < 0 ? state.currentTrackIndex : 0;
      const ts = tracks.length ? tracks[nextIndex].fixes.ts[0] : 0;
      return { ...state, tracks, currentTrackIndex: nextIndex, ts };
    }

    case SET_API_LOADING:
      return { ...state, loadingApi: action.payload.loading };

    case SET_TRACK_LOADING:
      return { ...state, loadingTracks: action.payload.loading };

    case SET_CHART_Y_AXIS:
      return { ...state, chart: { ...state.chart, yAxis: action.payload.y } };

    case SET_SCORE: {
      const { score } = action.payload;
      return { ...state, score };
    }

    case SET_DISTANCE: {
      const { distance } = action.payload;
      return { ...state, distance };
    }

    case INCREMENT_SPEED:
      return { ...state, speed: Math.floor(state.speed + 1) };

    case DECREMENT_SPEED:
      return { ...state, speed: Math.max(1, Math.floor(state.speed - 1)) };

    case SET_SPEED:
      return { ...state, speed: Math.max(1, action.payload.speed) };

    case SET_LEAGUE: {
      const { league } = action.payload;
      return { ...state, league };
    }

    case SET_SPEED_UNIT:
      return { ...state, units: { ...state.units, speed: action.payload.unit } };

    case SET_DISTANCE_UNIT:
      return { ...state, units: { ...state.units, distance: action.payload.unit } };

    case SET_ALTITUDE_UNIT:
      return { ...state, units: { ...state.units, altitude: action.payload.unit } };

    case SET_VARIO_UNIT:
      return { ...state, units: { ...state.units, vario: action.payload.unit } };

    case SET_DISPLAY_NAMES:
      return { ...state, displayNames: action.payload.enabled };

    case SET_DISPLAY_LIVE_NAMES:
      return { ...state, displayLiveNames: action.payload.enabled };

    case SET_CHART_AIRSPACES: {
      const { ts, airspaces } = action.payload;
      return { ...state, chart: { ...state.chart, ts, airspaces } };
    }

    case SET_VIEW_3D:
      return { ...state, view3d: action.payload.enabled };

    case SET_GEOLOC: {
      const { lat, lon } = action.payload.latLon;
      // The next initial location will be here.
      cookies({
        'init.lat': lat,
        'init.lon': lon,
      });
      return { ...state, location: { ...state.location, geoloc: { lat, lon } } };
    }

    case SET_CURRENT_LOCATION: {
      const { latLon, zoom } = action.payload;
      return { ...state, location: { ...state.location, current: { latLon, zoom } } };
    }

    case SET_FULL_SCREEN:
      return { ...state, fullscreen: action.payload.enabled };

    case RECEIVE_TRACK_WORKER_RESP: {
      const { alt, heading, id, maxAlt, minAlt, maxVz, minVz, vz } = action.payload.response;
      const tracks = state.tracks;
      let updated = false;
      tracks.forEach((track) => {
        if (track.id == id) {
          track.fixes.alt = alt;
          track.fixes.vz = vz;
          track.fixes.heading = heading;
          track.minAlt = minAlt;
          track.maxAlt = maxAlt;
          track.minVz = minVz;
          track.maxVz = maxVz;
          updated = true;
        }
      });
      return updated ? { ...state, tracks: [...tracks] } : state;
    }

    case SET_ALTITUDE_MULTIPLIER:
      return { ...state, altMultiplier: action.payload.multiplier };

    case SET_CENTER_MAP:
      return { ...state, centerMap: action.payload.enabled };

    default:
      return state;
  }
};

export default map;
