import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { deleteUrlParam, getUrlParamValues, ParamNames, setUrlParamValue } from '../logic/history';
import { Score } from '../logic/score/scorer';

export type PlannerState = {
  score?: Score;
  speed: number;
  distance: number;
  league: string;
  enabled: boolean;
  // Encoded route.
  route: string;
};

const route = getUrlParamValues(ParamNames.route)[0] ?? '';
const enabled = route.length > 0;

const initialState: PlannerState = {
  score: undefined,
  speed: Number(getUrlParamValues(ParamNames.speed)[0] ?? 20),
  distance: 0,
  league: getUrlParamValues(ParamNames.league)[0] ?? localStorage.getItem('league') ?? 'xc',
  enabled,
  route,
};

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    setScore: (state, action: PayloadAction<Score | undefined>) => {
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
      setUrlParamValue(ParamNames.league, action.payload);
      localStorage.setItem('league', action.payload);
      state.league = action.payload;
    },
    incrementSpeed: (state) => {
      state.speed = Math.floor(state.speed + 1);
      setUrlParamValue(ParamNames.speed, state.speed.toFixed(1));
    },
    decrementSpeed: (state) => {
      state.speed = Math.max(1, Math.floor(state.speed - 1));
      setUrlParamValue(ParamNames.speed, state.speed.toFixed(1));
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
  },
});

export const reducer = plannerSlice.reducer;
export const {
  setScore,
  setDistance,
  setSpeed,
  setLeague,
  incrementSpeed,
  decrementSpeed,
  setRoute,
  setEnabled,
} = plannerSlice.actions;
