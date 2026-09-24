import type { ScoringResult } from '@flyxc/optimizer/src/lib/optimizer';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { getUrlParamValues, ParamNames } from '../logic/history';
import type { LeagueCode } from '../logic/score/league/leagues';

export type PlannerState = {
  score?: ScoringResult;
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

export const DEFAULT_SPEED_KMH = 20;

export function parseSpeedParam(param: string | undefined): number {
  const speed = Number(param);
  return Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SPEED_KMH;
}

const initialState: PlannerState = {
  score: undefined,
  speedKmh: parseSpeedParam(getUrlParamValues(ParamNames.speed)[0]),
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
    setScore: (state, action: PayloadAction<ScoringResult | undefined>) => {
      state.score = action.payload;
    },
    setDistanceM: (state, action: PayloadAction<number>) => {
      state.distanceM = action.payload;
    },
    setSpeedKmh: (state, action: PayloadAction<number>) => {
      const speed = Number.isFinite(action.payload) && action.payload > 0 ? action.payload : DEFAULT_SPEED_KMH;
      state.speedKmh = Math.max(1, speed);
    },
    setLeague: (state, action: PayloadAction<LeagueCode>) => {
      state.league = action.payload;
    },
    incrementSpeed: (state) => {
      state.speedKmh = Math.floor(state.speedKmh + 1);
    },
    decrementSpeed: (state) => {
      state.speedKmh = Math.max(1, Math.floor(state.speedKmh - 1));
    },
    setRoute: (state, action: PayloadAction<string>) => {
      state.route = action.payload;
    },
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setIsFreeDrawing: (state, action: PayloadAction<boolean>) => {
      state.isFreeDrawing = action.payload;
    },
  },
  selectors: {
    selectScore: (state) => state.score,
    selectDistanceM: (state) => state.distanceM,
    selectSpeedKmh: (state) => state.speedKmh,
    selectLeague: (state) => state.league,
    selectRoute: (state) => state.route,
    selectEnabled: (state) => state.enabled,
    selectIsFreeDrawing: (state) => state.isFreeDrawing,
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

export const {
  selectScore,
  selectDistanceM,
  selectSpeedKmh,
  selectLeague,
  selectRoute,
  selectEnabled,
  selectIsFreeDrawing,
} = plannerSlice.selectors;
