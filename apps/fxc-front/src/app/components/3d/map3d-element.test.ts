import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as locationSlice from '../../redux/location-slice';
import { store } from '../../redux/store';
import { Map3dElement } from './map3d-element';

vi.mock('@arcgis/map-components/components/arcgis-compass', () => ({}));
vi.mock('@arcgis/map-components/components/arcgis-navigation-toggle', () => ({}));
vi.mock('@arcgis/map-components/components/arcgis-popup', () => ({}));
vi.mock('@arcgis/map-components/components/arcgis-scene', () => ({}));

describe('Map3dElement', () => {
  let element: Map3dElement;

  beforeEach(() => {
    vi.useFakeTimers();
    element = new Map3dElement();
  });

  afterEach(() => {
    element.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces handleLocation dispatches to Redux store by 250ms', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    (element as any).handleLocation({ lat: 45.1, lon: 6.1 });
    (element as any).handleLocation({ lat: 45.2, lon: 6.2 });
    (element as any).handleLocation({ lat: 45.3, lon: 6.3 });

    // Not dispatched synchronously
    expect(dispatchSpy).not.toHaveBeenCalledWith(locationSlice.setCurrentLocation(expect.anything()));

    // Fast-forward 249ms
    vi.advanceTimersByTime(249);
    expect(dispatchSpy).not.toHaveBeenCalledWith(locationSlice.setCurrentLocation(expect.anything()));

    // Fast-forward past 250ms debounce
    vi.advanceTimersByTime(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(2); // setCurrentLocation + setCurrentZoom
    expect(dispatchSpy).toHaveBeenCalledWith(locationSlice.setCurrentLocation({ lat: 45.3, lon: 6.3 }));
  });

  it('throttles SunLighting date updates to >= 300 seconds of track time', () => {
    const mockLightingSet = vi.fn();
    (element as any).view = {
      environment: {
        lighting: {
          set: mockLightingSet,
        },
      },
    };
    (element as any).sunEnabled = true;

    // Initial timeSec update should set date
    (element as any).timeSec = 1000;
    (element as any).shouldUpdate(new Map([['timeSec', 0]]));
    expect(mockLightingSet).toHaveBeenCalledTimes(1);
    expect(mockLightingSet).toHaveBeenCalledWith('date', new Date(1000 * 1000));

    // Minor scrub step (+50s) should be ignored
    (element as any).timeSec = 1050;
    (element as any).shouldUpdate(new Map([['timeSec', 1000]]));
    expect(mockLightingSet).toHaveBeenCalledTimes(1);

    // Minor scrub step (+150s, total 200s < 300s) should be ignored
    (element as any).timeSec = 1200;
    (element as any).shouldUpdate(new Map([['timeSec', 1050]]));
    expect(mockLightingSet).toHaveBeenCalledTimes(1);

    // Major scrub step (>= 300s delta from 1000) should update lighting
    (element as any).timeSec = 1300;
    (element as any).shouldUpdate(new Map([['timeSec', 1200]]));
    expect(mockLightingSet).toHaveBeenCalledTimes(2);
    expect(mockLightingSet).toHaveBeenCalledWith('date', new Date(1300 * 1000));
  });
});
