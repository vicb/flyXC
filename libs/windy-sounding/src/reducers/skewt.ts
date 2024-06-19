import { SET_P_MIN } from '../actions/skewt';

export function skewt(state = { pMax: 1000 }, action: any) {
  switch (action.type) {
    case SET_P_MIN:
      return { ...state, pMin: action.payload };
    default:
      return state;
  }
}
