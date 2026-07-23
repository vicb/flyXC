import type { ConvObj, MetricIdent, MetricInitParams, MetricItem } from './d.ts.files/Metric.d';
import type { NumValue } from './d.ts.files/types.d';
import type { DiscreteLegend, Legend } from './d.ts.files/legends.d';
export declare const rtrnSelf: (x: NumValue) => NumValue;
/**
 * # @windy/Metric
 *
 * Major Windy class for conversion of units, that are used in Windy.com.
 *
 * Enjoy methods like `convertValue`, `convertNumber`, `listMetrics`, `howManyMetrics`
 *
 * Never change users selected metric without user's action or consent.
 */
export declare abstract class Metric {
  /**
   * Store key
   */
  private key;
  /**
   * Keeps cohesion in between multiple metric instances. For example setting `in`
   * in rain will set `in` in snow also
   */
  cohesion?: {
    [ident in MetricIdent]?: {
      [unit in MetricItem]?: MetricItem;
    };
  };
  /**
   * Conversion functions
   */
  conv: ConvObj;
  /**
   * number ' ' metric separator
   */
  separator: '' | ' ';
  /**
   * Default metric for start-up
   * [ metric, imperial, ??? ]
   */
  defaults: MetricItem[];
  /**
   * Sync the metric to native iOS/Android apps
   */
  nativeSync: boolean;
  /**
   * Identifies metric
   */
  ident: MetricIdent;
  /**
   * Backward conversion functions
   */
  backConv?: ConvObj;
  /**
   * Actually selected unit
   */
  metric: MetricItem;
  /**
   * Gradiend legend associated with this metric
   */
  legend?: Legend | DiscreteLegend;
  /**
   * convertValue for this metric returns nonsense, so use convertValue
   */
  useConvertValue?: boolean;
  constructor(params: MetricInitParams);
  /**
   * get value + label on a basis of user selected metric
   */
  convertValue(value: NumValue, separator?: string, suffix?: string, forcedPrecision?: number): string;
  /**
   * Not available
   */
  na(): string | '-';
  /**
   * produces converted number value without label
   */
  abstract convertNumber(value: NumValue, forcedPrecision?: number, metric?: MetricItem, back?: boolean): number;
  /**
   * List all avail units
   */
  listMetrics(): MetricItem[];
  /**
   * How many metrics we have
   */
  howManyMetrics(): number;
  /**
   * Stores required metric into storage
   */
  setMetric(metric: MetricItem, ignoreCohesion?: boolean): void;
  /**
   * Cycles throu different metrics (for example after clicking on a legend)
   */
  cycleMetric(): void;
  protected initProperties(): void;
  private onMetricChanged;
  private getDefault;
  private setDefault;
  private createKey;
}
