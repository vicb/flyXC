import {
  FogMetric,
  NumberedMetric,
  PrecipMetric,
  PtypeMetric,
  SatelliteMetric,
  UVIndexMetric,
} from '@windy/MetricClasses';
import { NumValue } from '@windy/types.d';

/*
 * List of all supported metric identifiers
 */
export type MetricItem =
  | 'K'
  | '°C'
  | '°F'
  | 'kt'
  | 'bft'
  | 'm/s'
  | 'mph'
  | 'km/h'
  | '%'
  | 'rules'
  | 'hPa'
  | 'inHg'
  | 'mmHg'
  | 'mm'
  | 'in'
  | 'cm'
  | 'in'
  | 'J/kg'
  | 'DU'
  | 'AOD'
  | 'µg/m³'
  | 'mg/m²'
  | 'm'
  | 'ft'
  | 'km'
  | 'mi'
  | 'NM'
  | 'sm'
  | 'ppbv'
  | 'dBZ'
  | 'ptype'
  | 'type'
  | 'l/km²'
  | 'W/m²'
  | 'drought'
  | 'fwi'
  | 'mm/h'
  | 'in/h'
  | 'uvindex'
  | 'EDR'
  | 'km²'
  | 'acres';

/**
 * # @windy/metrics
 *
 * Contains already initialized instances of {@link Metric.Metric | Metric } classes, to recalculate
 * raw weather data, into units, that has user selected as his favorite, units
 *
 * @example
 * ```typescript
 * import metrics from '@windy/metrics';
 *
 * metrics.temp.convertNumber(234.9);
 * // converts 234.9 from Kelvin to Celsius or Fahrenheit
 * // based on users settings
 *
 * metrics.temp.convertValue(234.9);
 * // outputs string either -24.2°C or -11.5°F
 * ```
 * Complete list of Windy's supported metrics
 */
export interface MetricTypes {
  temp: NumberedMetric;
  wind: NumberedMetric;
  rh: NumberedMetric;
  clouds: NumberedMetric;
  pressure: NumberedMetric;
  rain: PrecipMetric;
  snow: NumberedMetric;
  cape: NumberedMetric;
  gtco3: NumberedMetric;
  aod550: NumberedMetric;
  pm2p5: NumberedMetric;
  no2: NumberedMetric;
  tcso2: NumberedMetric;
  go3: NumberedMetric;
  altitude: NumberedMetric;
  elevation: NumberedMetric;
  distance: NumberedMetric;
  speed: NumberedMetric;
  waves: NumberedMetric;
  currents: NumberedMetric;
  visibility: NumberedMetric;
  visibilityNoRules: NumberedMetric;
  so2: NumberedMetric;
  dust: NumberedMetric;
  cosc: NumberedMetric;
  radar: NumberedMetric;
  satellite: SatelliteMetric;
  ptype: PtypeMetric;
  gh: NumberedMetric;
  fog: FogMetric;
  lightDensity: NumberedMetric;
  efiWind: NumberedMetric;
  efiTemp: NumberedMetric;
  efiRain: NumberedMetric;
  drought: NumberedMetric;
  moistureAnom40: PrecipMetric;
  moistureAnom100: PrecipMetric;
  fwi: NumberedMetric;
  dfm10h: NumberedMetric;
  solarpower: NumberedMetric;
  uvindex: UVIndexMetric;
  capAlerts: NumberedMetric;
  turbulence: NumberedMetric;
  icing: NumberedMetric;
  area: NumberedMetric;
}

/** @ignore */
export type MetricIdent = keyof MetricTypes;

/** @ignore */
export type NumberedMetricIdent = keyof Pick<
  MetricTypes,
  {
    [M in keyof MetricTypes]: MetricTypes[M] extends NumberedMetric ? M : never;
  }[keyof MetricTypes]
>;

/** @ignore */
export type MetricKey = `metric_${MetricIdent}`;

type LegendItem = number | string;

type LegendDescription = MetricItem[]; // It is possible that some legends have custom desc

/**
 * Lines defining the legend. First column MUST be number, but we keep te type as easy as possible
 *
 * 1st column: value,
 * 2nd column: text for first metric (°C for example)
 * 3rd column: text for second metric (°F for example)
 * 4th column: and so on
 */
type LegendLines = [number, LegendItem, ...LegendItem[]][];

/** @ignore */
export interface Legend {
  /**
   * Legend description
   */
  description: LegendDescription;

  /**
   * Array defining how the legend will look like
   */
  lines: LegendLines;
}

export interface Conversion {
  /**
   * Conversion function
   */
  conversion: (x: NumValue) => NumValue;

  /**
   * Decimal precision
   */
  precision: number;

  /**
   * How should we mark Not Available in packer
   */
  na?: string;

  /**
   * Optional label
   */
  label?: string;
}

/** @ignore */
export type ConvObj = { [K in MetricItem]?: Conversion };

/** @ignore */
export type MetricInitParams = Pick<NumberedMetric, 'ident'> & Partial<NumberedMetric>;
