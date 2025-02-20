/**
 * Reusable color gradients
 */
import type { RGBA, ColorGradient } from '@windy/Color.d';
import type { NumValue } from '@windy/types';
export declare const moistureAnomaly: RGBA[];
export declare const airPollutant: RGBA[];
export declare const cloudBaseAndVisibility: RGBA[];
export declare const radarGradientAndValues: ColorGradient;
/**
 * Creates a color gradient from array of prepared ones
 */
export declare const createColorGradient: (gradient: RGBA[], numValues: NumValue[]) => ColorGradient;
