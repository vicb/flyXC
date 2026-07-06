import type { CoordsInterpolationFun, PixelInterpolationFun, RGBNumValues, InterpolatorPossibleReturns } from '@windy/interpolatorTypes';
export type { CoordsInterpolationFun, PixelInterpolationFun, RGBNumValues, InterpolatorPossibleReturns, };
export type InterpolatorFactory = {
    createFun: (cb: <T>(...args: unknown[]) => T | void) => void;
};
/**
 * Returns a Promise, that resolves with an lat lon interpolation function for given map view,
 * or null if no suitable renderer with interpolator is found.
 *
 * Always resolves, never rejects.
 */
export declare const getLatLonInterpolator: () => Promise<CoordsInterpolationFun | null>;
/**
 * Returns a Promise, that resolves with an X,Y interpolation function for given map view,
 * or null if no suitable renderer with interpolator is found.
 *
 * Always resolves, never rejects.
 */
export declare const getXYInterpolator: () => Promise<PixelInterpolationFun | null>;
