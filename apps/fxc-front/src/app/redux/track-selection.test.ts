import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import { reducer as liveTrackReducer, setCurrentLiveId } from './live-track-slice';
import { reducer as trackReducer, setCurrentTrackId } from './track-slice';

describe('track selection mutual exclusion (reducer-level)', () => {
  let store: ReturnType<typeof createTestStore>;

  function createTestStore() {
    return configureStore({
      reducer: {
        track: trackReducer,
        liveTrack: liveTrackReducer,
      },
    });
  }

  beforeEach(() => {
    store = createTestStore();
  });

  it('clears runtime track selection when a live track is selected', () => {
    store.dispatch(setCurrentTrackId('track-1'));
    expect(store.getState().track.currentTrackId).toBe('track-1');

    store.dispatch(setCurrentLiveId('live-1'));
    expect(store.getState().liveTrack.currentLiveId).toBe('live-1');
    expect(store.getState().track.currentTrackId).toBeUndefined();
  });

  it('clears live track selection when a runtime track is selected', () => {
    store.dispatch(setCurrentLiveId('live-1'));
    expect(store.getState().liveTrack.currentLiveId).toBe('live-1');

    store.dispatch(setCurrentTrackId('track-1'));
    expect(store.getState().track.currentTrackId).toBe('track-1');
    expect(store.getState().liveTrack.currentLiveId).toBeUndefined();
  });
});
