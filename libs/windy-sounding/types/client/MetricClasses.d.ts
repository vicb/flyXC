import { Metric } from '@windy/Metric';
import type { MetricItem, MetricInitParams } from '@windy/Metric.d';
import type { NumValue } from '@windy/types';
export declare class NumberedMetric extends Metric<number> {
  /**
   * produces converted number value without label
   *  - in case the @param back is set to true, inverse conversion is performed
   */
  convertNumber(value: NumValue, forcedPrecision?: number, metric?: MetricItem, back?: boolean): number;
}
export declare class CapAlertMetric extends Metric<number> {
  /**
   * Can be called by accident by some part of code
   */
  convertNumber(_value: NumValue): number;
}
export declare class PtypeMetric extends Metric<string> {
  convertNumber(i: number): string;
}
export declare class UVIndexMetric extends Metric<string> {
  convertNumber(i: number): string;
  convertValue(i: number): string;
}
export declare class FogMetric extends Metric<string> {
  convertNumber(i: number): string;
  convertValue(i: number): string;
}
export declare class SatelliteMetric extends NumberedMetric {
  constructor(params: MetricInitParams);
  /**
   * Dynamic update from minifest/info.json
   * @param pars various pars depending on concrete instance
   */
  updateLines(pars: [number, number], radarEnabled?: boolean): void;
}
export declare class PrecipMetric extends NumberedMetric {
  initProperties(): void;
}
