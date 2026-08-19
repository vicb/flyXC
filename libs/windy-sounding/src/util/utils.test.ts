import type { Fav } from '@windy/favs';

import { formatTimestamp, getFavLabel, getSupportedModelName, isSupportedModelName } from './utils';

describe('utils', () => {
  describe('isSupportedModelName', () => {
    it('should return true for supported models', () => {
      expect(isSupportedModelName('ecmwf')).toBe(true);
      expect(isSupportedModelName('gfs')).toBe(true);
      expect(isSupportedModelName('nam')).toBe(true);
      expect(isSupportedModelName('namConus')).toBe(true);
      expect(isSupportedModelName('icon')).toBe(true);
      expect(isSupportedModelName('iconEu')).toBe(true);
      expect(isSupportedModelName('hrrr')).toBe(true);
      expect(isSupportedModelName('ukv')).toBe(true);
      expect(isSupportedModelName('aromeFrance')).toBe(true);
      expect(isSupportedModelName('czeAladin')).toBe(true);
      expect(isSupportedModelName('canHrdps')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(isSupportedModelName('arome')).toBe(false);
      expect(isSupportedModelName('waves')).toBe(false);
      expect(isSupportedModelName('wind')).toBe(false);
      expect(isSupportedModelName('unknown')).toBe(false);
      expect(isSupportedModelName('')).toBe(false);
    });
  });

  describe('getSupportedModelName', () => {
    it('should return the model name if supported', () => {
      expect(getSupportedModelName('gfs')).toBe('gfs');
      expect(getSupportedModelName('iconEu')).toBe('iconEu');
    });

    it('should return ecmwf fallback if model is unsupported', () => {
      expect(getSupportedModelName('arome')).toBe('ecmwf');
      expect(getSupportedModelName('unknown')).toBe('ecmwf');
    });
  });

  describe('getFavLabel', () => {
    it('should return the title of favorite if available', () => {
      const fav: Fav = { title: 'Mount Blanc', lat: 45.83, lon: 6.86 };
      expect(getFavLabel(fav)).toBe('Mount Blanc');
    });

    it('should return empty string if title is missing', () => {
      const fav = { lat: 45.83, lon: 6.86 } as Fav;
      expect(getFavLabel(fav)).toBe('');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp into readable string', () => {
      const ts = Date.UTC(2026, 7, 19, 12, 0); // 2026-08-19 12:00 UTC
      const formatted = formatTimestamp(ts);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
