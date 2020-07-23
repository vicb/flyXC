import cookies from 'cookiesjs';
import { Action, ActionCreator } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';

import { RuntimeTrack } from '../../../../common/track';
import { addUrlParamValue, ParamNames } from '../logic/history';
import { scheduleMetadataFetch } from '../logic/metadata';
import { Score } from '../logic/score/scorer';
import { UNITS } from '../logic/units';
import { ChartYAxis, MapState } from '../reducers/map';
import { RootState } from '../store';

export const ADD_TRACKS = 'ADD_TRACKS';
export const CLOSE_ACTIVE_TRACK = 'CLOSE_ACTIVE_TRACK';
export const CLOSE_TRACK_BY_ID = 'CLOSE_TRACK_BY_ID';
export const DECREMENT_SPEED = 'DECREMENT_SPEED';
export const FETCH_METADATA = 'FETCH_METADATA';
export const INCREMENT_SPEED = 'INCREMENT_SPEED';
export const MOVE_CLOSE_TO = 'MOVE_CLOSE_TO';
export const RECEIVE_METADATA = 'RECEIVE_METADATA';
export const SET_ALTITUDE_UNIT = 'SET_ALTITUDE_UNIT';
export const SET_ASP_ALTITUDE = 'SET_ASP_ALTITUDE';
export const SET_ASP_SHOW_RESTRICTED = 'SET_ASP_SHOW_RESTRICTED';
export const SET_CHART_AIRSPACES = 'SET_CHART_ASP';
export const SET_CHART_Y_AXIS = 'SET_CHART_Y_AXIS';
export const SET_CURRENT_TRACK = 'SET_CURRENT_TRACK';
export const SET_DISPLAY_LIVE_NAMES = 'SET_DISPLAY_LIVES_NAMES';
export const SET_DISPLAY_NAMES = 'SET_DISPLAY_NAMES';
export const SET_DISTANCE = 'SET_DISTANCE';
export const SET_DISTANCE_UNIT = 'SET_DISTANCE_UNIT';
export const SET_FETCHING_METADATA = 'SET_FETCHING_METADATA';
export const SET_LEAGUE = 'SET_LEAGUE';
export const SET_LOADING = 'SET_LOADING';
export const SET_MAP = 'SET_MAP';
export const SET_SCORE = 'SET_SCORE';
export const SET_SPEED = 'SET_SPEED';
export const SET_SPEED_UNIT = 'SET_SPEED_UNIT';
export const SET_TS = 'SET_TS';
export const SET_VARIO_UNIT = 'SET_VARIO_UNIT';
export const ZOOM_TRACKS = 'ZOOM_TRACKS';

// Actions

export interface SetMap extends Action<typeof SET_MAP> {
  payload: { map: google.maps.Map };
}

export interface AddTracks extends Action<typeof ADD_TRACKS> {
  payload: { tracks: RuntimeTrack[] };
}

export interface MoveCloseTo extends Action<typeof MOVE_CLOSE_TO> {
  payload: { lat: number; lon: number };
}
export type ZoomTracks = Action<typeof ZOOM_TRACKS>;

export interface SetTs extends Action<typeof SET_TS> {
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

export type CloseActiveTrack = Action<typeof CLOSE_ACTIVE_TRACK>;

export interface CloseTrackById extends Action<typeof CLOSE_TRACK_BY_ID> {
  payload: { id: number };
}

export interface SetLoading extends Action<typeof SET_LOADING> {
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

export type MapThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action>;

export type MapAction =
  | AddTracks
  | CloseActiveTrack
  | CloseTrackById
  | DecrementSpeed
  | FetchMetadata
  | IncrementSpeed
  | MoveCloseTo
  | ReceiveMetadata
  | SetAltitudeUnit
  | SetAspAltitude
  | SetAspShowRestricted
  | SetChartAirspaces
  | SetChartYAxis
  | SetCurrentTrack
  | SetDisplayLiveNames
  | SetDisplayNames
  | SetDistance
  | SetDistanceUnit
  | SetFetchingMetadata
  | SetLeague
  | SetLoading
  | SetMap
  | SetScore
  | SetSpeed
  | SetSpeedUnit
  | SetTs
  | SetVarioUnit
  | ZoomTracks;

// Action creators

export const setMap: ActionCreator<SetMap> = (map: google.maps.Map) => ({
  type: SET_MAP,
  payload: { map },
});

export const receiveTracks = (tracks: RuntimeTrack[]): MapThunk => (
  dispatch: ThunkDispatch<MapState, void, MapAction>,
  getState: () => RootState,
): void => {
  dispatch(addTracks(tracks));
  dispatch(fetchMetadata(tracks));
  // Add all the track ids to the current URL.
  tracks.forEach((track) => {
    if (track.id != null) {
      addUrlParamValue(ParamNames.TRACK_ID, String(track.id));
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

export const zoomTracks: ActionCreator<ZoomTracks> = () => ({ type: ZOOM_TRACKS });

export const setTs: ActionCreator<SetTs> = (ts: number) => ({
  type: SET_TS,
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

export const closeActiveTrack: ActionCreator<CloseActiveTrack> = () => ({ type: CLOSE_ACTIVE_TRACK });

export const closeTrackById: ActionCreator<CloseTrackById> = (id: number) => ({
  type: CLOSE_TRACK_BY_ID,
  payload: { id },
});

export const setLoading: ActionCreator<SetLoading> = (loading: boolean) => ({
  type: SET_LOADING,
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
