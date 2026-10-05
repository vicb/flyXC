import { Metric } from '@windy/Metric';
import type { MetricInitParams, MetricItem } from '@windy/Metric.d';
import type { NumValue } from '@windy/types';
export declare class NumberedMetric extends Metric {
    /**
     * produces converted number value without label
     *  - in case the @param back is set to true, inverse conversion is performed
     */
    convertNumber(value: NumValue, forcedPrecision?: number, metric?: MetricItem, back?: boolean): number;
}
export declare class DiscreteMetric extends Metric {
    readonly useConvertValue = true;
    convertNumber(value: NumValue): number;
}
export declare class CloudsMetric extends NumberedMetric {
    readonly useConvertValue = true;
    convertValue(value: NumValue, separator?: string, suffix?: string, forcedPrecision?: number): string;
    private getRulesLabel;
}
export declare class PtypeMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class RadarPTypeMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class UVIndexMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class DroughtMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class FwiMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class FogMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class TurbulenceMetric extends NumberedMetric {
    readonly useConvertValue = true;
    convertValue(i: number): string;
}
export declare class IcingMetric extends DiscreteMetric {
    convertValue(i: number): string;
}
export declare class PrecipMetric extends NumberedMetric {
    initProperties(): void;
}
export declare class SatelliteMetric extends NumberedMetric {
    private _defaultTempParams;
    constructor(params: MetricInitParams);
    private get tempParams();
    initProperties(): void;
}
