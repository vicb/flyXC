import { expect } from '@jest/globals';
import {
  decimalDegreeToDegreesMinutes,
  degreesMinutesToDecimalDegrees,
  getLatitudeCardinal,
  getLatitudeSign,
  getLongitudeCardinal,
  getLongitudeSign,
} from './geo';

describe('decimalDegreeToDegreesMinutes', () => {
  it('should convert >= 0 values', () => {
    expect(decimalDegreeToDegreesMinutes(0)).toEqual({ degrees: 0, minutes: 0 });
    expect(decimalDegreeToDegreesMinutes(10)).toEqual({ degrees: 10, minutes: 0 });
    expect(decimalDegreeToDegreesMinutes(45)).toEqual({ degrees: 45, minutes: 0 });
    expect(decimalDegreeToDegreesMinutes(90)).toEqual({ degrees: 90, minutes: 0 });
    expect(decimalDegreeToDegreesMinutes(180)).toEqual({ degrees: 180, minutes: 0 });

    expect(decimalDegreeToDegreesMinutes(20.1)).toMatchObject({ degrees: 20, minutes: expect.closeTo(6) });
    expect(decimalDegreeToDegreesMinutes(20.5)).toMatchObject({ degrees: 20, minutes: expect.closeTo(30) });
    expect(decimalDegreeToDegreesMinutes(20.9)).toMatchObject({ degrees: 20, minutes: expect.closeTo(54) });
  });

  it('should throw for negative values', () => {
    expect(() => decimalDegreeToDegreesMinutes(-1)).toThrowErrorMatchingInlineSnapshot(`"dd should be >= 0"`);
  });
});

describe('degreesMinutesToDecimalDegrees', () => {
  it('should convert >= 0 values', () => {
    expect(degreesMinutesToDecimalDegrees({ degrees: 0, minutes: 0 })).toBeCloseTo(0);
    expect(degreesMinutesToDecimalDegrees({ degrees: 10, minutes: 0 })).toBeCloseTo(10);
    expect(degreesMinutesToDecimalDegrees({ degrees: 45, minutes: 0 })).toBeCloseTo(45);
    expect(degreesMinutesToDecimalDegrees({ degrees: 90, minutes: 0 })).toBeCloseTo(90);
    expect(degreesMinutesToDecimalDegrees({ degrees: 180, minutes: 0 })).toBeCloseTo(180);

    expect(degreesMinutesToDecimalDegrees({ degrees: 20, minutes: 6 })).toBeCloseTo(20.1);
    expect(degreesMinutesToDecimalDegrees({ degrees: 20, minutes: 30 })).toBeCloseTo(20.5);
    expect(degreesMinutesToDecimalDegrees({ degrees: 20, minutes: 54 })).toBeCloseTo(20.9);
  });

  it('should throw for negative values', () => {
    expect(() => degreesMinutesToDecimalDegrees({ degrees: -1, minutes: 0 })).toThrowErrorMatchingInlineSnapshot(
      `"degrees and minutes should be >= 0"`,
    );
    expect(() => degreesMinutesToDecimalDegrees({ degrees: -1, minutes: -1 })).toThrowErrorMatchingInlineSnapshot(
      `"degrees and minutes should be >= 0"`,
    );
    expect(() => degreesMinutesToDecimalDegrees({ degrees: 0, minutes: -1 })).toThrowErrorMatchingInlineSnapshot(
      `"degrees and minutes should be >= 0"`,
    );
  });
});

it('getLatitudeCardinal', () => {
  expect(getLatitudeCardinal(0)).toEqual('N');
  expect(getLatitudeCardinal(45)).toEqual('N');
  expect(getLatitudeCardinal(-45)).toEqual('S');
});

it('getLatitudeSign', () => {
  expect(getLatitudeSign('N')).toEqual(1);
  expect(getLatitudeSign('n')).toEqual(1);
  expect(getLatitudeSign('S')).toEqual(-1);
  expect(getLatitudeSign('s')).toEqual(-1);
});

it('getLongitudeCardinal', () => {
  expect(getLongitudeCardinal(0)).toEqual('E');
  expect(getLongitudeCardinal(45)).toEqual('E');
  expect(getLongitudeCardinal(-45)).toEqual('W');
});

it('getLongitudeSign', () => {
  expect(getLongitudeSign('E')).toEqual(1);
  expect(getLongitudeSign('e')).toEqual(1);
  expect(getLongitudeSign('W')).toEqual(-1);
  expect(getLongitudeSign('w')).toEqual(-1);
});
