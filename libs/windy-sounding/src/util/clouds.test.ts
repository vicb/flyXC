import type { MeteogramDataHash } from '@windy/interfaces';

import { computePeriodClouds, getCloudCoverGenerator } from './clouds';

describe('clouds', () => {
  describe('getCloudCoverGenerator', () => {
    it('should sample cloud cover at a specific pressure level', () => {
      // 100 values ranging from 0 to 100
      const cloudCover = Array.from({ length: 100 }, (_, i) => i);
      const generator = getCloudCoverGenerator(cloudCover);

      // Low altitude / high pressure (1000 hPa -> index near 0)
      expect(generator(1000)).toBeCloseTo(0, 0);

      // High altitude / low pressure (100 hPa -> index near 99)
      expect(generator(100)).toBeCloseTo(99, 0);
    });

    it('should find minimum cloud cover in a pressure range', () => {
      const cloudCover = [10, 20, 5, 40, 50];
      const generator = getCloudCoverGenerator(cloudCover);

      const minVal = generator(1000, 100);
      expect(minVal).toBe(5);
    });
  });

  describe('computePeriodClouds', () => {
    it('should compute period clouds from humidity levels', () => {
      const hoursCount = 5;
      const mockDataHash = {
        'rh-1000h': new Array(hoursCount).fill(50),
        'rh-950h': new Array(hoursCount).fill(60),
        'rh-925h': new Array(hoursCount).fill(70),
        'rh-900h': new Array(hoursCount).fill(80),
        'rh-850h': new Array(hoursCount).fill(85),
        'rh-800h': new Array(hoursCount).fill(90),
        'rh-700h': new Array(hoursCount).fill(75),
        'rh-600h': new Array(hoursCount).fill(60),
        'rh-500h': new Array(hoursCount).fill(50),
        'rh-400h': new Array(hoursCount).fill(40),
        'rh-300h': new Array(hoursCount).fill(30),
        'rh-200h': new Array(hoursCount).fill(20),
        'rh-150h': new Array(hoursCount).fill(10),
        'rh-100h': new Array(hoursCount).fill(5),
      } as unknown as MeteogramDataHash;

      const result = computePeriodClouds(mockDataHash);

      expect(result.width).toBe(4 * hoursCount);
      expect(result.height).toBe(300);
      expect(result.clouds.length).toBe(result.width * result.height);
      expect(result.clouds.some((val) => typeof val === 'number')).toBe(true);
    });

    it('should throw when a required relative humidity level is missing', () => {
      const mockDataHash = {
        'rh-1000h': [50, 60],
      } as unknown as MeteogramDataHash;

      expect(() => computePeriodClouds(mockDataHash)).toThrow('Missing rh-950h');
    });
  });
});
