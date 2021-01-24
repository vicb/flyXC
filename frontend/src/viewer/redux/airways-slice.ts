import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AirwaysState = {
  show: boolean;
  opacity: number;
};

const initialState: AirwaysState = {
  show: false,
  opacity: 100,
};

const airwaysSlice = createSlice({
  name: 'skyways',
  initialState,
  reducers: {
    setShow: (state, action: PayloadAction<boolean>) => {
      state.show = action.payload;
    },
    setOpacity: (state, action: PayloadAction<number>) => {
      state.opacity = action.payload;
    },
  },
});

export const reducer = airwaysSlice.reducer;
export const { setShow, setOpacity } = airwaysSlice.actions;
