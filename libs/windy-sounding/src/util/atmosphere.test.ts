import {
  dewpoint,
  dryLapse,
  getElevation,
  mixingRatio,
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
  });
});
