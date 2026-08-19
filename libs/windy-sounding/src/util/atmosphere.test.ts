import {
  dewpoint,
  dryLapse,
  getElevation,
  getPressureToGhScale,
  mixingRatio,
  parcelTrajectory,
  saturationMixingRatio,
  saturationVaporPressure,
  vaporPressure,
  wetTempGradient,
} from './atmosphere';

describe('atmosphere', () => {
  describe('dryLapse', () => {
    it('should return the correct temperature for a given pressure', () => {
      const tempK0 = 288.15; // 15°C
      const pressure0 = 1013.25; // hPa
      const pressure = 800; // hPa

      expect(dryLapse(pressure, tempK0, pressure0)).toBeCloseTo(269.35, 2);
    });

    it('should return the starting temperature when pressure is the same', () => {
      const tempK0 = 288.15; // 15°C
      const pressure0 = 1013.25; // hPa

      expect(dryLapse(pressure0, tempK0, pressure0)).toBe(tempK0);
    });

    it('should handle different starting pressures', () => {
      const tempK0 = 293.15; // 20°C
      const pressure0 = 950; // hPa
      const pressure = 750; // hPa

      expect(dryLapse(pressure, tempK0, pressure0)).toBeCloseTo(274.01, 2);
    });

    describe('mixingRatio', () => {
      it('should calculate the correct mixing ratio for water vapor', () => {
        const partialPressure = 10; // hPa
        const totalPressure = 1013.25; // hPa
        const expectedMixingRatio = mixingRatio(partialPressure, totalPressure);
        expect(expectedMixingRatio).toBeCloseTo(0.0061996, 6);
      });

      it('should handle different molecular weight ratios', () => {
        const partialPressure = 5; // hPa
        const totalPressure = 1000; // hPa
        const molecularWeightRatio = 0.5;
        const expectedMixingRatio = mixingRatio(partialPressure, totalPressure, molecularWeightRatio);
        expect(expectedMixingRatio).toBeCloseTo(0.00251, 5);
      });
    });

    describe('saturationMixingRatio', () => {
      it('should calculate the correct saturation mixing ratio', () => {
        const pressure = 1000; // hPa
        const tempK = 288.15; // 15°C
        const expectedSaturationMixingRatio = saturationMixingRatio(pressure, tempK);
        expect(expectedSaturationMixingRatio).toBeCloseTo(0.0105, 3);
      });
    });

    describe('saturationVaporPressure', () => {
      it('should calculate the correct saturation vapor pressure', () => {
        const tempK = 288.15; // 15°C
        const expectedSaturationVaporPressure = saturationVaporPressure(tempK);
        expect(expectedSaturationVaporPressure).toBeCloseTo(17.04, 2);
      });
    });

    describe('wetTempGradient', () => {
      it('should calculate the correct wet temperature gradient', () => {
        const pressure = 1000; // hPa
        const tempK = 288.15; // 15°C
        const expectedWetTempGradient = wetTempGradient(pressure, tempK);
        expect(expectedWetTempGradient).toBeCloseTo(0.0397, 4);
      });
    });

    describe('vaporPressure', () => {
      it('should calculate the correct vapor pressure', () => {
        const pressure = 1013.25; // hPa
        const mixing = 0.01;
        const expectedVaporPressure = vaporPressure(pressure, mixing);
        expect(expectedVaporPressure).toBeCloseTo(16.03, 2);
      });
    });

    describe('dewpoint', () => {
      it('should calculate the correct dewpoint', () => {
        const pressure = 10; // hPa
        const expectedDewpoint = dewpoint(pressure);
        expect(expectedDewpoint).toBeCloseTo(280.13, 2);
      });
    });

    describe('getElevation', () => {
      it('should calculate the correct elevation', () => {
        const pressure = 800; // hPa
        const expectedElevation = getElevation(pressure);
        expect(expectedElevation).toBeCloseTo(1949, 0);
      });

      it('should handle different sea level pressures', () => {
        const pressure = 900; // hPa
        const seaLevelPressure = 1020; // hPa
        const expectedElevation = getElevation(pressure, seaLevelPressure);
        expect(expectedElevation).toBeCloseTo(1043, 0);
      });
    });

    describe('getPressureToGhScale', () => {
      it('should create a valid pressure to gh scale with sea level pressure', () => {
        const levels = [1000, 850, 700, 500];
        const ghByLevel = [110, 1450, 3000, 5500];
        const seaLevelPressure = 1013.25;

        const scale = getPressureToGhScale(levels, ghByLevel, seaLevelPressure);
        expect(scale(seaLevelPressure)).toBeCloseTo(0, 1);
        expect(scale(850)).toBeCloseTo(1450, 1);
        expect(scale.invert(3000)).toBeCloseTo(700, 1);
      });

      it('should create a valid scale when seaLevelPressure is <= max level', () => {
        const levels = [1000, 850, 700];
        const ghByLevel = [100, 1450, 3000];
        const seaLevelPressure = 990;

        const scale = getPressureToGhScale(levels, ghByLevel, seaLevelPressure);
        expect(scale(1000)).toBeCloseTo(100, 1);
        expect(scale(850)).toBeCloseTo(1450, 1);
      });
    });

    describe('parcelTrajectory', () => {
      it('should compute dry parcel trajectory and thermal top', () => {
        const levels = [1000, 950, 900, 850, 800, 700, 600, 500];
        const ghByLevel = [100, 500, 1000, 1500, 2000, 3000, 4200, 5600];
        const tempByLevel = [293.15, 290.15, 287.15, 284.15, 281.15, 273.15, 263.15, 250.15];
        const thermalDeltaTemp = 3;
        const surfaceElevation = 100;
        const surfaceDewpoint = 270.15;
        const steps = 50;

        const result = parcelTrajectory(
          levels,
          ghByLevel,
          tempByLevel,
          thermalDeltaTemp,
          surfaceElevation,
          surfaceDewpoint,
          steps,
        );

        expect(result.thermalTopElev).toBeGreaterThan(surfaceElevation);
        expect(result.thermalTopPressure).toBeLessThan(levels[0]);
        expect(result.dry.length).toBeGreaterThan(0);
      });

      it('should return empty parcel when no thermal intersection exists', () => {
        const levels = [1000, 850, 700];
        const ghByLevel = [100, 1500, 3000];
        const tempByLevel = [290, 295, 300]; // Inversion where start temp is cooler than ambient
        const thermalDeltaTemp = -10;
        const surfaceElevation = 100;
        const surfaceDewpoint = 270;
        const steps = 20;

        const result = parcelTrajectory(
          levels,
          ghByLevel,
          tempByLevel,
          thermalDeltaTemp,
          surfaceElevation,
          surfaceDewpoint,
          steps,
        );

        expect(result.thermalTopElev).toBe(0);
        expect(result.dry).toEqual([]);
      });
    });
  });
});
