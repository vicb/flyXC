import cookies from 'cookiesjs';
import { Action, ActionCreator } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';

import { LatLon, RuntimeTrack } from '../../../common/track';
import { addUrlParamValue, ParamNames } from './logic/history';
import { scheduleMetadataFetch } from './logic/metadata';
import { Score } from './logic/score/scorer';
import { UNITS } from './logic/units';
import { ChartYAxis, MapState } from './reducers';
import { RootState } from './store';
import { Request, Response } from './workers/track';

export const ADD_TRACKS = 'ADD_TRACKS';
export const DECREMENT_SPEED = 'DECREMENT_SPEED';
export const FETCH_METADATA = 'FETCH_METADATA';
export const INCREMENT_SPEED = 'INCREMENT_SPEED';
export const MOVE_CLOSE_TO = 'MOVE_CLOSE_TO';
export const RECEIVE_METADATA = 'RECEIVE_METADATA';
export const RECEIVE_TRACK_WORKER_RESP = 'RECEIVE_TRKW_RESP';
export const REMOVE_TRACKS_BY_ID = 'DEL_TRACKS_BY_ID';
export const SET_ALTITUDE_MULTIPLIER = 'SET_ALTITUDE_MULTI';
export const SET_ALTITUDE_UNIT = 'SET_ALTITUDE_UNIT';
export const SET_API_LOADING = 'SET_API_LOADING';
export const SET_ASP_ALTITUDE = 'SET_ASP_ALTITUDE';
export const SET_ASP_SHOW_RESTRICTED = 'SET_ASP_SHOW_RESTRICTED';
export const SET_CENTER_MAP = 'SET_CENTER_MAP';
export const SET_CHART_AIRSPACES = 'SET_CHART_ASP';
export const SET_CHART_Y_AXIS = 'SET_CHART_Y_AXIS';
export const SET_CURRENT_LOCATION = 'SET_CURRENT_LOCATION';
export const SET_CURRENT_TRACK = 'SET_CURRENT_TRACK';
export const SET_DISPLAY_LIVE_NAMES = 'SET_DISPLAY_LIVES_NAMES';
export const SET_DISPLAY_NAMES = 'SET_DISPLAY_NAMES';
export const SET_DISTANCE = 'SET_DISTANCE';
export const SET_DISTANCE_UNIT = 'SET_DISTANCE_UNIT';
export const SET_FETCHING_METADATA = 'SET_FETCHING_METADATA';
export const SET_FULL_SCREEN = 'SET_FS';
export const SET_GEOLOC = 'SET_GEOLOC';
export const SET_LEAGUE = 'SET_LEAGUE';
export const SET_SCORE = 'SET_SCORE';
export const SET_SPEED = 'SET_SPEED';
export const SET_SPEED_UNIT = 'SET_SPEED_UNIT';
export const SET_TRACK_LOADING = 'SET_TRACK_LOADING';
export const SET_TIMESTAMP = 'SET_TS';
export const SET_VARIO_UNIT = 'SET_VARIO_UNIT';
export const SET_VIEW_3D = 'SET_VIEW_3D';

// Actions
export interface AddTracks extends Action<typeof ADD_TRACKS> {
  payload: { tracks: RuntimeTrack[] };
}

export interface MoveCloseTo extends Action<typeof MOVE_CLOSE_TO> {
  payload: { lat: number; lon: number };
}
export interface SetTimestamp extends Action<typeof SET_TIMESTAMP> {
  payload: { ts: number };
}

export interface SetCurrentTrack extends Action<typeof SET_CURRENT_TRACK> {
  payload: { index: number };
}

export interface SetAspAltitude extends Action<typeof SET_ASP_ALTITUDE> {
  payload: { aspAltitude: number };
}

export interface SetAspShowRestricted extends Action<typeof SET_ASP_SHOW_RESTRICTED> {
  payload: { aspShowRestricted: boolean };
}

export interface RemoveTracksById extends Action<typeof REMOVE_TRACKS_BY_ID> {
  payload: { ids: number[] };
}

export interface SetApiLoading extends Action<typeof SET_API_LOADING> {
  payload: { loading: boolean };
}

export interface SetTrackLoading extends Action<typeof SET_TRACK_LOADING> {
  payload: { loading: boolean };
}

export interface SetChartYAxis extends Action<typeof SET_CHART_Y_AXIS> {
  payload: { y: ChartYAxis };
}

export interface SetScore extends Action<typeof SET_SCORE> {
  payload: { score: Score | null };
}

export interface SetDistance extends Action<typeof SET_DISTANCE> {
  payload: { distance: number };
}

export type IncrementSpeed = Action<typeof INCREMENT_SPEED>;
export type DecrementSpeed = Action<typeof DECREMENT_SPEED>;

export interface SetSpeed extends Action<typeof SET_SPEED> {
  payload: { speed: number };
}

export interface SetLeague extends Action<typeof SET_LEAGUE> {
  payload: { league: string };
}

export interface SetSpeedUnit extends Action<typeof SET_SPEED_UNIT> {
  payload: { unit: UNITS };
}

export interface SetDistanceUnit extends Action<typeof SET_DISTANCE_UNIT> {
  payload: { unit: UNITS };
}

export interface SetAltitudeUnit extends Action<typeof SET_ALTITUDE_UNIT> {
  payload: { unit: UNITS };
}

export interface SetVarioUnit extends Action<typeof SET_VARIO_UNIT> {
  payload: { unit: UNITS };
}

export interface FetchMetadata extends Action<typeof FETCH_METADATA> {
  payload: { tracks: RuntimeTrack[] };
}

export interface ReceiveMetadata extends Action<typeof RECEIVE_METADATA> {
  payload: { metaTracks: ArrayBuffer };
}

export interface SetFetchingMetadata extends Action<typeof SET_FETCHING_METADATA> {
  payload: { isFetching: boolean };
}

export interface SetDisplayNames extends Action<typeof SET_DISPLAY_NAMES> {
  payload: { enabled: boolean };
}

export interface SetDisplayLiveNames extends Action<typeof SET_DISPLAY_LIVE_NAMES> {
  payload: { enabled: boolean };
}

export interface SetChartAirspaces extends Action<typeof SET_CHART_AIRSPACES> {
  payload: { ts: number; airspaces: string[] };
}

export interface SetView3d extends Action<typeof SET_VIEW_3D> {
  payload: { enabled: boolean };
}

export interface SetCurrentLocation extends Action<typeof SET_CURRENT_LOCATION> {
  payload: { latLon: LatLon; zoom: number };
}

export interface SetGeoloc extends Action<typeof SET_GEOLOC> {
  payload: { latLon: LatLon };
}

export interface SetFullscreen extends Action<typeof SET_FULL_SCREEN> {
  payload: { enabled: boolean };
}

export interface ReceiveTrackWorkerResponse extends Action<typeof RECEIVE_TRACK_WORKER_RESP> {
  payload: { response: Response };
}

export interface SetAltitudeMultiplier extends Action<typeof SET_ALTITUDE_MULTIPLIER> {
  payload: { multiplier: number };
}

export interface SetCenterMap extends Action<typeof SET_CENTER_MAP> {
  payload: { enabled: boolean };
}

export type MapThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;

export type MapAction =
  | AddTracks
  | DecrementSpeed
  | FetchMetadata
  | IncrementSpeed
  | MoveCloseTo
  | ReceiveMetadata
  | ReceiveTrackWorkerResponse
  | RemoveTracksById
  | SetAltitudeMultiplier
  | SetAltitudeUnit
  | SetApiLoading
  | SetAspAltitude
  | SetAspShowRestricted
  | SetCenterMap
  | SetChartAirspaces
  | SetChartYAxis
  | SetCurrentLocation
  | SetCurrentTrack
  | SetDisplayLiveNames
  | SetDisplayNames
  | SetDistance
  | SetDistanceUnit
  | SetFetchingMetadata
  | SetFullscreen
  | SetGeoloc
  | SetLeague
  | SetScore
  | SetSpeed
  | SetSpeedUnit
  | SetTrackLoading
  | SetTimestamp
  | SetVarioUnit
  | SetView3d;

// Action creators

// Client side track processing.
let trackWorker: Worker | undefined;

export const receiveTracks = (tracks: RuntimeTrack[]): MapThunk => (
  dispatch: ThunkDispatch<MapState, void, MapAction>,
  getState: () => RootState,
): void => {
  if (!trackWorker) {
    trackWorker = new Worker('js/workers/track.js');
    trackWorker.onmessage = (msg: MessageEvent<Response>) => {
      dispatch(receiveTrackWorkerResponse(msg.data));
    };
  }
  dispatch(addTracks(tracks));
  // Actual fetching is started with `scheduleMetadataFetch`.
  dispatch(fetchMetadata(tracks));

  tracks.forEach((track) => {
    if (track.id != null) {
      // Add all the track ids to the current URL.
      addUrlParamValue(ParamNames.TRACK_ID, String(track.id));
      // Start client side processing.
      const req: Request = {
        alt: track.fixes.alt,
        id: track.id,
        lat: track.fixes.lat,
        lon: track.fixes.lon,
        ts: track.fixes.ts,
      };
      trackWorker?.postMessage(req);
    }
  });

  // Schedule a fetch when some tracks need metadata and no fetch is already started.
  if (!getState().map?.metadata.isFetching && tracks.some((track) => !track.isPostProcessed)) {
    dispatch(setFetchingMetadata(true));
    scheduleMetadataFetch(dispatch, getState);
  }
};

export const addTracks: ActionCreator<AddTracks> = (tracks: RuntimeTrack[]) => ({
  type: ADD_TRACKS,
  payload: { tracks },
});

export const fetchMetadata: ActionCreator<FetchMetadata> = (tracks: RuntimeTrack[]) => ({
  type: FETCH_METADATA,
  payload: { tracks },
});

export const receiveMetadata: ActionCreator<ReceiveMetadata> = (metaTracks: ArrayBuffer) => ({
  type: RECEIVE_METADATA,
  payload: { metaTracks },
});

export const setFetchingMetadata: ActionCreator<SetFetchingMetadata> = (isFetching: boolean) => ({
  type: SET_FETCHING_METADATA,
  payload: { isFetching },
});

export const moveCloseTo: ActionCreator<MoveCloseTo> = (lat: number, lon: number) => ({
  type: MOVE_CLOSE_TO,
  payload: { lat, lon },
});

export const setTimestamp: ActionCreator<SetTimestamp> = (ts: number) => ({
  type: SET_TIMESTAMP,
  payload: { ts },
});

export const setCurrentTrack: ActionCreator<SetCurrentTrack> = (index: number) => ({
  type: SET_CURRENT_TRACK,
  payload: { index },
});

export const setAspAltitude: ActionCreator<SetAspAltitude> = (aspAltitude) => ({
  type: SET_ASP_ALTITUDE,
  payload: { aspAltitude },
});

export const setAspShowRestricted: ActionCreator<SetAspShowRestricted> = (aspShowRestricted) => ({
  type: SET_ASP_SHOW_RESTRICTED,
  payload: { aspShowRestricted },
});

export const removeTracksById: ActionCreator<RemoveTracksById> = (ids: number[]) => ({
  type: REMOVE_TRACKS_BY_ID,
  payload: { ids },
});

export const setApiLoading: ActionCreator<SetApiLoading> = (loading: boolean) => ({
  type: SET_API_LOADING,
  payload: { loading },
});

export const setTrackLoading: ActionCreator<SetTrackLoading> = (loading: boolean) => ({
  type: SET_TRACK_LOADING,
  payload: { loading },
});

export const setChartYAxis: ActionCreator<SetChartYAxis> = (y: ChartYAxis) => ({
  type: SET_CHART_Y_AXIS,
  payload: { y },
});

export const setScore: ActionCreator<SetScore> = (score: Score | null) => ({
  type: SET_SCORE,
  payload: { score },
});

export const setDistance: ActionCreator<SetDistance> = (distance: number) => ({
  type: SET_DISTANCE,
  payload: { distance },
});

export const incrementSpeed: ActionCreator<IncrementSpeed> = () => ({ type: INCREMENT_SPEED });

export const decrementSpeed: ActionCreator<DecrementSpeed> = () => ({ type: DECREMENT_SPEED });

export const setSpeed: ActionCreator<SetSpeed> = (speed: number) => ({
  type: SET_SPEED,
  payload: { speed },
});

export const setLeague: ActionCreator<SetLeague> = (league: string) => {
  cookies({ league });
  return {
    type: SET_LEAGUE,
    payload: { league },
  };
};

export const setSpeedUnit: ActionCreator<SetSpeedUnit> = (unit: UNITS) => {
  cookies({ 'unit.speed': unit });
  return {
    type: SET_SPEED_UNIT,
    payload: { unit },
  };
};

export const setDistanceUnit: ActionCreator<SetDistanceUnit> = (unit: UNITS) => {
  cookies({ 'unit.distance': unit });
  return {
    type: SET_DISTANCE_UNIT,
    payload: { unit },
  };
};

export const setAltitudeUnit: ActionCreator<SetAltitudeUnit> = (unit: UNITS) => {
  cookies({ 'unit.altitude': unit });
  return {
    type: SET_ALTITUDE_UNIT,
    payload: { unit },
  };
};

export const setVarioUnit: ActionCreator<SetVarioUnit> = (unit: UNITS) => {
  cookies({ 'unit.vario': unit });
  return {
    type: SET_VARIO_UNIT,
    payload: { unit },
  };
};

export const setDisplayNames: ActionCreator<SetDisplayNames> = (enabled: boolean) => ({
  type: SET_DISPLAY_NAMES,
  payload: { enabled },
});

export const setDisplayLiveNames: ActionCreator<SetDisplayLiveNames> = (enabled: boolean) => ({
  type: SET_DISPLAY_LIVE_NAMES,
  payload: { enabled },
});

export const setChartAirspaces: ActionCreator<SetChartAirspaces> = (ts: number, airspaces: string[]) => ({
  type: SET_CHART_AIRSPACES,
  payload: { ts, airspaces },
});

export const setView3d: ActionCreator<SetView3d> = (enabled: boolean) => ({
  type: SET_VIEW_3D,
  payload: { enabled },
});

export const setCurrentLocation: ActionCreator<SetCurrentLocation> = (latLon: LatLon, zoom: number) => ({
  type: SET_CURRENT_LOCATION,
  payload: { latLon, zoom },
});

export const setGeoloc: ActionCreator<SetGeoloc> = (latLon: LatLon) => ({
  type: SET_GEOLOC,
  payload: { latLon },
});

export const setFullscreen: ActionCreator<SetFullscreen> = (enabled: boolean) => ({
  type: SET_FULL_SCREEN,
  payload: { enabled },
});

export const receiveTrackWorkerResponse: ActionCreator<ReceiveTrackWorkerResponse> = (response: Response) => ({
  type: RECEIVE_TRACK_WORKER_RESP,
  payload: { response },
});

export const setAltitudeMultiplier: ActionCreator<SetAltitudeMultiplier> = (multiplier: number) => ({
  type: SET_ALTITUDE_MULTIPLIER,
  payload: { multiplier },
});

export const setCenterMap: ActionCreator<SetCenterMap> = (enabled: boolean) => ({
  type: SET_CENTER_MAP,
  payload: { enabled },
});
