import type { Fav } from '@windy/favs';

import {
  formatLayerAltitude,
  formatRainAmount,
  formatTimestamp,
  getAvailableModels,
  getFavLabel,
  getSupportedModelName,
  isSupportedModelName,
  latLon2Str,
  METEOBLUE_AI_MODEL,
} from './utils';

describe('utils', () => {
  describe('getAvailableModels', () => {
    it('should return sorted supported models for location including mblue', () => {
      // Mock W.models.getAllPointProducts
      (globalThis as any).W = {
        models: {
          getAllPointProducts: vi.fn().mockReturnValue(['icon', 'arome', 'ecmwf', 'unknown', 'iconD2', 'gfs', 'rrfs']),
        },
      };

      const models = getAvailableModels({ lat: 45, lon: 6 });
      expect(models).toEqual(['ecmwf', 'gfs', 'icon', 'iconD2', METEOBLUE_AI_MODEL, 'rrfs']);
    });
  });

  describe('isSupportedModelName', () => {
    it.each([
      'ecmwf',
      'gfs',
      'nam',
      'namConus',
      'icon',
      'iconEu',
      'rrfs',
      'rrfs-conus',
      'rrfsConus',
      'hrrr',
      'ukv',
      'aromeFrance',
      'bomAccess',
      'bomAccessSy',
      'czeAladin',
      'canHrdps',
      'jmaMsm',
      METEOBLUE_AI_MODEL,
    ])('should return true for supported model %s', (model) => {
      expect(isSupportedModelName(model)).toBe(true);
    });

    it.each(['arome', 'waves', 'wind', 'unknown', ''])('should return false for unsupported model %j', (model) => {
      expect(isSupportedModelName(model)).toBe(false);
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

  describe('latLon2Str', () => {
    it('should convert lat/lon to string using W.utils.latLon2str', () => {
      (globalThis as any).W = {
        utils: {
          latLon2str: vi.fn().mockImplementation(({ lat, lon }: any) => `${lat},${lon}`),
        },
      };
      expect(latLon2Str({ lat: 45.83, lon: 6.86 })).toBe('45.83,6.86');
      expect(latLon2Str({ lat: '45.83', lon: '6.86' })).toBe('45.83,6.86');
    });
  });

  describe('formatLayerAltitude', () => {
    beforeEach(() => {
      (globalThis as any).W = {
        rootScope: {
          levelsData: {
            surface: ['', '', 0, 0],
            '100m': ['100 m', '100m', 100, 300],
            '975h': ['975 hPa', '975h', 300, 1000],
            '950h': ['950 hPa', '950h', 600, 2000],
            '925h': ['925 hPa', '925h', 750, 2500],
            '900h': ['900 hPa', '900h', 1000, 3000],
            '850h': ['850 hPa', '850h', 1500, 5000],
            '800h': ['800 hPa', '800h', 2000, 6400],
            '700h': ['700 hPa', '700h', 3000, 10000],
            '600h': ['600 hPa', '600h', 4200, 14000],
            '500h': ['500 hPa', '500h', 5500, 18000],
            '400h': ['400 hPa', '400h', 7000, 24000],
            '300h': ['300 hPa', '300h', 9000, 30000],
            '250h': ['250 hPa', '250h', 10400, 34000],
            '200h': ['200 hPa', '200h', 11800, 39000],
            '150h': ['150 hPa', '150h', 13500, 45000],
            '10h': ['10 hPa', '10h', 30000, 100000],
          },
        },
      };
    });

    it('should return Surface for surface or undefined level', () => {
      expect(formatLayerAltitude(undefined)).toBe('Surface');
      expect(formatLayerAltitude('surface')).toBe('Surface');
      expect(formatLayerAltitude('surface', 'ft')).toBe('Surface');
    });

    it('should format 100m level in meters and feet', () => {
      expect(formatLayerAltitude('100m', 'm')).toBe('100m');
      expect(formatLayerAltitude('100m', 'ft')).toBe('300ft');
    });

    it.each([
      ['950h', 'm', '600m'],
      ['950h', 'ft', '2000ft'],
      ['850h', 'm', '1500m'],
      ['850h', 'ft', '5000ft'],
      ['700h', 'm', '3000m'],
      ['700h', 'ft', '10kft'],
      ['500h', 'm', '5500m'],
      ['500h', 'ft', '18kft'],
      ['250h', 'm', '10.4km'],
      ['250h', 'ft', '34kft'],
      ['10h', 'm', '30km'],
      ['10h', 'ft', '100kft'],
    ])('should format pressure level %s in %s as %s', (level, unit, expected) => {
      expect(formatLayerAltitude(level, unit)).toBe(expected);
    });

    it('should prioritize W.rootScope.levelsData when available', () => {
      (globalThis as any).W = {
        rootScope: {
          levelsData: {
            '850h': ['850 hPa', '850h', 1520, 5050],
          },
        },
      };

      expect(formatLayerAltitude('850h', 'm')).toBe('1520m');
      expect(formatLayerAltitude('850h', 'ft')).toBe('5050ft');
    });
  });

  describe('formatRainAmount', () => {
    it.each([
      [0, 'mm', '0mm'],
      [0, 'in', '0in'],
      [-1, 'mm', '0mm'],
      [undefined, 'mm', '0mm'],
      [NaN, 'in', '0in'],
    ])('should format invalid/zero rain %s in %s as %s', (rainMm, unit, expected) => {
      expect(formatRainAmount(rainMm, unit)).toBe(expected);
    });

    it.each([
      [1.2, 'mm', '1.2mm'],
      [1.0, 'mm', '1mm'],
      [0.5, 'mm', '0.5mm'],
      [2.34, 'mm', '2.3mm'],
      // 25.4 mm = 1.0 in, 1.2 mm ≈ 0.0472 in -> 0.05, 0.5 mm ≈ 0.0197 in -> 0.02
      [25.4, 'in', '1in'],
      [1.2, 'in', '0.05in'],
      [0.5, 'in', '0.02in'],
    ])('should format %s mm in %s as %s', (rainMm, unit, expected) => {
      expect(formatRainAmount(rainMm, unit)).toBe(expected);
    });
  });
});
