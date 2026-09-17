import { describe, expect, it } from 'vitest';

import { DEFAULT_SPEED_KMH, parseSpeedParam, reducer, setSpeedKmh } from './planner-slice';

describe('planner-slice', () => {
  describe('parseSpeedParam', () => {
    it('should default to 20 when passed 0 or negative', () => {
      expect(parseSpeedParam('0')).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('0.0')).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('-5')).toBe(DEFAULT_SPEED_KMH);
    });

    it('should default to 20 when passed empty or whitespace', () => {
      expect(parseSpeedParam('')).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('   ')).toBe(DEFAULT_SPEED_KMH);
    });

    it('should default to 20 when passed undefined or non-numbers', () => {
      expect(parseSpeedParam(undefined)).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('abc')).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('NaN')).toBe(DEFAULT_SPEED_KMH);
      expect(parseSpeedParam('Infinity')).toBe(DEFAULT_SPEED_KMH);
    });

    it('should parse valid positive numbers', () => {
      expect(parseSpeedParam('25')).toBe(25);
      expect(parseSpeedParam('33.5')).toBe(33.5);
    });
  });

  describe('setSpeedKmh reducer', () => {
    const defaultState = {
      score: undefined,
      speedKmh: DEFAULT_SPEED_KMH,
      distanceM: 0,
      league: 'xc' as const,
      enabled: false,
      route: '',
      isFreeDrawing: false,
    };

    it('should default to 20 if passed 0 or invalid numbers', () => {
      const state1 = reducer(defaultState, setSpeedKmh(0));
      expect(state1.speedKmh).toBe(20);

      const state2 = reducer(defaultState, setSpeedKmh(NaN));
      expect(state2.speedKmh).toBe(20);
    });

    it('should set valid speeds', () => {
      const state = reducer(defaultState, setSpeedKmh(35));
      expect(state.speedKmh).toBe(35);
    });
  });
});
