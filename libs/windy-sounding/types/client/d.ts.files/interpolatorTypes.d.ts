import { NumValue } from '@windy/types.d';
import { LatLon } from '@windy/interfaces.d';

/**
 * Returned values in data RGB channels as tuple [NumValue, NumValue, NumValue]
 */
export type RGBNumValues = [NumValue, NumValue, NumValue];

/**
 * Possible returns from interpolator
 *
 * `null`    - out of map
 *
 * `NaN`     - no data value
 *
 * `-1`      - not suitable renderer
 *
 * `[number,number,number]` - computed values
 */
export type InterpolatorPossibleReturns = RGBNumValues | null | undefined | number;

/**
 * Interpolates pixel to tuple weather values from RGB channels
 */
export type PixelInterpolationFun = (
  x: number,
  y: number,
  mercXpx?: number, // mercator coords in pixels (needed for radar and satellite)
  mercYpx?: number,
) => InterpolatorPossibleReturns;

/**
 * Interpolates coordinates to tuple weather values from RGB channels
 */
export type CoordsInterpolationFun = <T extends LatLon>(latLon: T) => InterpolatorPossibleReturns;
