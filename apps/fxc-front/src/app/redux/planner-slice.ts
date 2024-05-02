import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { deleteUrlParam, getUrlParamValues, ParamNames, setUrlParamValue } from '../logic/history';
import { Score } from '../logic/score/scorer';
import { LeagueCode } from '../logic/score/league';
import { LEAGUES } from '../logic/score/league/leagues';

export type PlannerState = {
  score?: Score;
  speed: number;
  distance: number;
  league: LeagueCode;
  leagueName: string;
  enabled: boolean;
  // Encoded route.
  route: string;
  isFreeDrawing: boolean;
};

const route = getUrlParamValues(ParamNames.route)[0] ?? '';
const enabled = route.length > 0;

function getLeagueCode() {
  return (getUrlParamValues(ParamNames.league)[0] ?? localStorage.getItem('league') ?? 'xc') as LeagueCode;
}

const initialState: PlannerState = {
  score: undefined,
  speed: Number(getUrlParamValues(ParamNames.speed)[0] ?? 20),
  distance: 0,
  league: getLeagueCode(),
  leagueName: LEAGUES[getLeagueCode()].name,
  enabled,
  route,
  isFreeDrawing: false,
};

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    setPlannerScore: (state, action: PayloadAction<Score | undefined>) => {
      state.score = action.payload;
    },
    setDistance: (state, action: PayloadAction<number>) => {
      state.distance = action.payload;
    },
    setSpeed: (state, action: PayloadAction<number>) => {
      state.speed = Math.max(1, action.payload);
      setUrlParamValue(ParamNames.speed, state.speed.toFixed(1));
    },
    setLeague: (state, action: PayloadAction<string>) => {
      const leagueCode = action.payload as LeagueCode;
      setUrlParamValue(ParamNames.league, leagueCode);
      localStorage.setItem('league', leagueCode);
      state.league = leagueCode;
      state.leagueName = LEAGUES[leagueCode].name;
    },
    incrementSpeed: (state) => {
      state.speed = Math.floor(state.speed + 1);
      setUrlParamValue(ParamNames.speed, state.speed.toFixed(1));
    },
    decrementSpeed: (state) => {
      state.speed = Math.max(1, Math.floor(state.speed - 1));
      setUrlParamValue(ParamNames.speed, state.speed.toFixed(1));
    },
    setPlannerRoute: (state, action: PayloadAction<string>) => {
      const route = action.payload;
      if (route.length == 0) {
        deleteUrlParam(ParamNames.route);
      } else {
        setUrlParamValue(ParamNames.route, route);
      }
      state.route = route;
    },
    setPlannerEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setPlannerIsFreeDrawing: (state, action: PayloadAction<boolean>) => {
      state.isFreeDrawing = action.payload;
    },
  },
});

export const reducer = plannerSlice.reducer;
export const {
  setPlannerScore,
  setDistance,
  setSpeed,
  setLeague,
  incrementSpeed,
  decrementSpeed,
  setPlannerRoute,
  setPlannerEnabled,
  setPlannerIsFreeDrawing,
} = plannerSlice.actions;
