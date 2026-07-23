import type { RGBA, RGBString, ColorGradient, NumValue, ColorGradientString } from '@windy/types.d';
export type ColorIdent =
  | 'temp'
  | 'wind'
  | 'rh'
  | 'pressure'
  | 'cclAltitude'
  | 'deg0'
  | 'levels'
  | 'rain'
  | 'ptype'
  | 'rainClouds'
  | 'clouds'
  | 'lclouds'
  | 'hclouds'
  | 'mclouds'
  | 'cape'
  | 'lightDensity'
  | 'cbase'
  | 'snow'
  | 'rainAccu'
  | 'waves'
  | 'currents'
  | 'visibility'
  | 'gtco3'
  | 'aod550'
  | 'pm2p5'
  | 'no2'
  | 'tcso2'
  | 'go3'
  | 'cosc'
  | 'dust'
  | 'satellite'
  | 'radar'
  | 'fog'
  | 'justGray'
  | 'efiWind'
  | 'efiTemp'
  | 'efiRain'
  | 'moistureAnom40'
  | 'moistureAnom100'
  | 'drought'
  | 'soilMoisture'
  | 'fwi'
  | 'dfm10h'
  | 'solarpower'
  | 'wavePower'
  | 'uvindex'
  | 'turbulence'
  | 'icing'
  | 'wetbulbtemp'
  | 'aqi'
  | 'dewpoint'
  | 'sst'
  | 'fallback';
export type PluginColorIdent =
  | 'windDetail'
  | 'wavesDetail'
  | 'periodDetail'
  | 'altitudeDetail'
  | 'visibilityDetail'
  | 'dewpointSpreadDetail'
  | 'blitz'
  | 'pmDetail'
  | 'dustDetail'
  | 'coscDetail'
  | 'no2Detail'
  | 'pollenDetail'
  | 'so2Detail'
  | 'aqiGradientDetail'
  | 'wavePowerDetail';
export type AnyColorIdent =
  | ColorIdent
  | PluginColorIdent
  | 'pressureIsolines'
  | 'temporary'
  | 'direction'
  | 'airgramColor'
  | 'tempFillColors'
  | 'tideGraphColors'
  | 'aqiFillColors';
export interface UserColor {
  id: AnyColorIdent;
  gradient: ColorGradient;
}
export type ColorInitParams = Pick<Color, 'ident'> &
  Partial<Pick<Color, 'qualitative'>> & {
    default: ColorGradientString;
    steps?: number;
    opaque?: boolean;
    prepare?: boolean;
    /**
     * Min and max gradient value override
     *  - used for gradients with constant min and max values
     *  - e.g. radar with [0,256] in all cases (gradient is not resized based on the current gradient extents)
     */
    minMaxValue?: [NumValue, NumValue];
  };
/**
 * Stores a precomputed gradient.
 * The gradient is defined over a min->max range of numerical values.
 */
export declare class PrecomputedGradient {
  /**
   * Index of the first byte of the last color in the precomputed array.
   * Note that one color is made up of 4 bytes.
   */
  private readonly _maxIndex;
  /**
   * The value step between neighbouring precomputed gradient colors.
   */
  private readonly _step;
  /**
   * Minimum of the value range over which the gradient is precomputed.
   */
  readonly min: number;
  /**
   * Maximum of the value range over which the gradient is precomputed.
   */
  readonly max: number;
  /**
   * The count of precomputed gradient colors.
   */
  readonly steps: number;
  /**
   * The byte array of precomputed gradient colors, 4 bytes each.
   */
  readonly precomputedColors: Uint8Array;
  /**
   * Initializes a gradient with precomputed colors.
   * @param gradient - The gradient definition.
   * @param steps - The count of precomputed colors.
   * @param min - The minimum of the value range for which the gradient will be precomputed.
   * @param max - The maximum of the value range for which the gradient will be precomputed.
   * @param opaque - When true, all alpha values are set to 255.
   * @param premultiply - When true, RGB color values are premultiplied by alpha (which is interpreted as range 0..1 for the purposes of premultiplication).
   */
  constructor(
    gradient: ColorGradient,
    steps: number,
    min: number,
    max: number,
    opaque?: boolean,
    premultiply?: boolean,
  );
  /**
   * Returns a color based 'rgb()' string on provided value
   */
  color(value: NumValue): RGBString;
  /**
   * Returns darkened or lightened coercion of original color.
   * Uses the most primitive method of darkening/lightening by subtracting
   * or adding a value to RGB components.
   *
   * @param value Numerical value at which to sample the gradient.
   * @param amount Amount of darkening or lightening in a range -255 to 255. Values are subtracted from the 0..255 RGB channels. Positive values are darkening.
   */
  colorDark(value: NumValue, amount: number): RGBString;
  /**
   * Returns RGB array based on value
   */
  RGBA(value: NumValue): RGBA;
  /**
   * Returns index to the color table bytes based on arbitrary value.
   */
  private _value2index;
}
export declare class Color {
  /**
   * When true, the color table will be precomputed in advance, without calling getColor()
   *
   * DO NOT MISUSE THIS PROPERTY, generating color gradients is expensive
   * CPU operation and should be done only when needed
   *
   * Use only for few colors that are used
   * for initial rendering and overall app, like temp, wind
   */
  private prepare?;
  /** Set all alpha values to 255.  By default is set true */
  private opaque?;
  /** Initial gradient */
  private initialColorGradient;
  /** Initial gradient, that was parsed to RGBA arrays from RGBAStrings */
  private defaultColorGradient?;
  /** Custom modified gradient */
  private customColorGradient?;
  private minMaxValue?;
  private _precomputedGradient;
  /** Ident of color */
  ident: AnyColorIdent;
  /** globe: use discrete palette (not blending between colors) */
  qualitative?: boolean;
  /** Number of steps for colors table */
  steps: number;
  /**
   * The minimum of the value range for which the gradient is generated.
   */
  get min(): number;
  /**
   * The maximum of the value range for which the gradient is generated.
   */
  get max(): number;
  constructor(params: ColorInitParams);
  loadCustomColor(): Promise<void>;
  hasCustomColor(): boolean;
  /**
   * Updates custom color gradient
   */
  setCustomColor(gradient: ColorGradient, saveToIdb?: boolean): Promise<void>;
  /**
   * Removes custom color gradient
   */
  removeCustomColor(): Promise<void>;
  /**
   * Generates gradient array for fast access to color table, if not already generated.
   */
  getColor(): PrecomputedGradient;
  getColorGradient(): ColorGradient;
  /**
   * Returns a color based 'rgb()' string on provided value
   */
  color(value: NumValue): RGBString;
  /**
   * Returns darkened or lightened coercion of original color.
   * Uses the most primitive method of darkening/lightening by subtracting
   * or adding a value to RGB components.
   *
   * @param value Numerical value at which to sample the gradient.
   * @param amount Amount of darkening or lightening in a range -255 to 255. Values are subtracted from the 0..255 RGB channels. Positive values are darkening.
   */
  colorDark(value: NumValue, amount: number): RGBString;
  /**
   * Returns RGB array based on value
   */
  RGBA(value: NumValue): RGBA;
  private _generatePrecomputedColors;
}
