import type { ColorGradient, AnyColorIdent, RGBA, RGBString } from './d.ts.files/Color.d';
import type { NumValue } from './d.ts.files/types.d';
export type ColorInitParams = Pick<Color, 'ident'> &
  Partial<Pick<Color, 'qualitative'>> & {
    steps: number;
    default: ColorGradient;
    opaque?: boolean;
    prepare?: boolean;
  };
export declare class Color {
  /**
   * Should be color table prepared in advance without calling getColor()
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
  /** Items precomputed for fast color access */
  private maxIndex;
  /** Items precomputed for fast color access */
  private step;
  /** Index of neutral gray color */
  private neutralGrayIndex;
  /** Initial gradient */
  private defaultColorGradient;
  /** Custom modified gradient */
  private customColorGradient?;
  /** Big interpolated RGBA Type array color table, generated when color is required */
  private colors?;
  /** Min value of associated numerical value  */
  min: NumValue;
  /** Max value  of associated numerical value  */
  max: NumValue;
  /** Ident of color */
  ident: AnyColorIdent;
  /** globe: use discrete palette (not blending between colors) */
  qualitative?: boolean;
  /** Number of steps for colors table */
  steps: number;
  constructor(params: ColorInitParams);
  getColorTable(): Uint8Array;
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
   * Returns a color based 'rgb()' string on provided value
   */
  color(value: NumValue): RGBString;
  /**
   * Returns darkened or lightened coercion of original color. Uses the
   * most primitive method of darkening/lightening by subtracting or
   * adding vale to RGB components
   *
   * @param value Original numerical value
   * @param amount Amount of darkening or lightening in a range -255 to 255
   */
  colorDark(value: NumValue, amount: number): RGBString;
  /**
   * Returns RGB array based on value
   */
  RGBA(value: NumValue): RGBA;
  /**
   * create gradient array usable for both WebGL texture and getColor() function
   * bOpaque .. set alpha to 255
   * bPremultiply .. mul RGB by A
   * valueScale .. optional scale used for WebGL texture data (coef 0.5 means half step - gradient size is doubled)
   * return .. output Uint8Array with color data (NOTE: Uint8ClampedArray NOT SUPPORTED in WebGL!)
   */
  createGradientArray(bOpaque?: boolean, bPremultiply?: boolean, valueScale?: number): Uint8Array;
  /**
   * Generates gradient array for fast access to color table
   */
  getColor(): this;
  /**
   * Returns index to the color table based on value
   */
  value2index(value: NumValue): number;
  getColorGradient(): ColorGradient;
  /**
   * Checks validity of a gradient that it adheres to type ColorGradient
   */
  static checkValidity(obj: unknown): boolean;
  /**
   * return array multiplied by mul coef
   */
  private getMulArray;
  /**
   * linear interpolation between array components, factor = <0.0,1.0>;
   */
  private lerpArray;
  /**
   * color = [ r01, g01, b01, ? ]; components in interval <0.0; 1.0>
   */
  private rgba2yuva;
  /**
   * color = [ y, u, v, ? ]; y = <0.0; 1.0>, u, v = <-0.5; 0.5>
   */
  private yuva2rgba;
  /**
   * preserveSaturation .. (maintain |UV| size)
   */
  private gradYuva;
  /**
   * interpolation between 2 colors in selected space (type)
   * type .. color space / interpolation type: 'RGB' - linear in RGB space (default)
   * col1, col2 .. [r, g, b, a]; factor = <0.0,1.0>;
   */
  private getGradientColorYUVA;
  /**
   * rgbaArray .. [r, g, b, a]; componnents in interval <0;255>
   */
  private makePremultiplied;
  /**
   * If color table was already generated, we need to regenerate it
   */
  private regenerateColorTable;
}
