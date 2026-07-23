import { Metric } from '@windy/Metric';
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
    | 'kW/m'
    | 'drought'
    | 'fwi'
    | 'mm/h'
    | 'in/h'
    | 'uvindex'
    | 'EDR'
    | 'km²'
    | 'acres'
    | 'AQI'
    | 'gr./m³'
    | 'fallback'
    | 's.';

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
export type MetricIdent =
    | 'temp'
    | 'wind'
    | 'rh'
    | 'clouds'
    | 'pressure'
    | 'rain'
    | 'snow'
    | 'cape'
    | 'gtco3'
    | 'aod550'
    | 'pm2p5'
    | 'no2'
    | 'tcso2'
    | 'go3'
    | 'altitude'
    | 'elevation'
    | 'distance'
    | 'speed'
    | 'waves'
    | 'currents'
    | 'visibility'
    | 'visibilityNoRules'
    | 'so2'
    | 'dust'
    | 'cosc'
    | 'radar'
    | 'satellite'
    | 'ptype'
    | 'radarPType'
    | 'gh'
    | 'fog'
    | 'lightDensity'
    | 'efiWind'
    | 'efiTemp'
    | 'efiRain'
    | 'drought'
    | 'moistureAnom40'
    | 'moistureAnom100'
    | 'fwi'
    | 'dfm10h'
    | 'solarpower'
    | 'wavePower'
    | 'uvindex'
    | 'turbulence'
    | 'icing'
    | 'area'
    | 'aqi'
    | 'pollen'
    | 'fallback'
    | 'period';

/** @ignore */
export type MetricKey = `metric_${MetricIdent}`;

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
export type MetricInitParams = Pick<Metric, 'ident'> &
    Partial<
        Pick<
            Metric,
            'conv' | 'backConv' | 'defaults' | 'cohesion' | 'nativeSync' | 'separator' | 'legend'
        >
    >;
