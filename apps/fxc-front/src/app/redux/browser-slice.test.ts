import { describe, expect, it } from 'vitest';

import {
  reducer,
  selectCountry,
  selectIsFullscreen,
  selectIsVisible,
  setCountry,
  setIsFullscreen,
  setIsVisible,
} from './browser-slice';

describe('browserSlice', () => {
  it('updates country correctly', () => {
    const initialState = reducer(undefined, { type: 'unknown' });
    expect(selectCountry({ browser: initialState } as any)).toBeUndefined();

    const stateWithCountry = reducer(initialState, setCountry('FR'));
    expect(selectCountry({ browser: stateWithCountry } as any)).toBe('FR');

    const stateCleared = reducer(stateWithCountry, setCountry(undefined));
    expect(selectCountry({ browser: stateCleared } as any)).toBeUndefined();
  });

  it('updates isFullscreen correctly', () => {
    const initialState = reducer(undefined, { type: 'unknown' });
    const stateFs = reducer(initialState, setIsFullscreen(true));
    expect(selectIsFullscreen({ browser: stateFs } as any)).toBe(true);

    const stateNonFs = reducer(stateFs, setIsFullscreen(false));
    expect(selectIsFullscreen({ browser: stateNonFs } as any)).toBe(false);
  });

  it('updates isVisible correctly', () => {
    const initialState = reducer(undefined, { type: 'unknown' });
    const stateVisible = reducer(initialState, setIsVisible(false));
    expect(selectIsVisible({ browser: stateVisible } as any)).toBe(false);

    const stateBack = reducer(stateVisible, setIsVisible(true));
    expect(selectIsVisible({ browser: stateBack } as any)).toBe(true);
  });
});
