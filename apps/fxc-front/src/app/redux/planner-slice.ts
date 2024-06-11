import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { deleteUrlParam, getUrlParamValues, ParamNames, setUrlParamValue } from '../logic/history';
import type { LeagueCode } from '../logic/score/league/leagues';
import type { Score } from '../logic/score/scorer';

export type PlannerState = {
  score?: Score;
  speedKmh: number;
  // Total length of the path.
  distanceM: number;
  league: LeagueCode;
  enabled: boolean;
  // Encoded route.
  route: string;
  isFreeDrawing: boolean;
};

const route = getUrlParamValues(ParamNames.route)[0] ?? '';
const enabled = route.length > 0;

const initialState: PlannerState = {
  score: undefined,
  speedKmh: Number(getUrlParamValues(ParamNames.speed)[0] ?? 20),
  distanceM: 0,
  league: (getUrlParamValues(ParamNames.league)[0] ?? localStorage.getItem('league') ?? 'xc') as LeagueCode,
  enabled,
  route,
  isFreeDrawing: false,
};

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    setScore: (state, action: PayloadAction<Score | undefined>) => {
      state.score = action.payload;
    },
    setDistanceM: (state, action: PayloadAction<number>) => {
      state.distanceM = action.payload;
    },
    setSpeedKmh: (state, action: PayloadAction<number>) => {
      state.speedKmh = Math.max(1, action.payload);
      setUrlParamValue(ParamNames.speed, state.speedKmh.toFixed(1));
    },
    setLeague: (state, action: PayloadAction<LeagueCode>) => {
      setUrlParamValue(ParamNames.league, action.payload);
      localStorage.setItem('league', action.payload);
      state.league = action.payload;
    },
    incrementSpeed: (state) => {
      state.speedKmh = Math.floor(state.speedKmh + 1);
      setUrlParamValue(ParamNames.speed, state.speedKmh.toFixed(1));
    },
    decrementSpeed: (state) => {
      state.speedKmh = Math.max(1, Math.floor(state.speedKmh - 1));
      setUrlParamValue(ParamNames.speed, state.speedKmh.toFixed(1));
    },
    setRoute: (state, action: PayloadAction<string>) => {
      const route = action.payload;
      if (route.length == 0) {
        deleteUrlParam(ParamNames.route);
      } else {
        setUrlParamValue(ParamNames.route, route);
      }
      state.route = route;
    },
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setIsFreeDrawing: (state, action: PayloadAction<boolean>) => {
      state.isFreeDrawing = action.payload;
    },
  },
});

export const reducer = plannerSlice.reducer;
export const {
  setScore,
  setDistanceM,
  setSpeedKmh,
  setLeague,
  incrementSpeed,
  decrementSpeed,
  setRoute,
  setEnabled,
  setIsFreeDrawing,
} = plannerSlice.actions;
