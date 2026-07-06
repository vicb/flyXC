import type { Color } from './d.ts.files/Color';
import type {
  ConvObj,
  Legend,
  LegendDescription,
  LegendLines,
  MetricIdent,
  MetricInitParams,
  MetricItem,
} from './d.ts.files/Metric.d';
import type { NumValue, LoadedTranslations, RGBString } from './d.ts.files/types.d';
export declare const rtrnSelf: (x: NumValue) => NumValue;
/**
 * # @windy/Metric
 *
 * Major Windy class for conversion of units, that are used in Windy.com.
 *
 * Enjoy methods like `convertValue`, `convertNumber`, `listMetrics`, `howManyMetrics`
 *
 * Never ever, change users selected metric without their consent.
 */
export declare abstract class Metric<T extends string | number = string | number> {
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
   * Array defining how the legend will look like
   */
  lines: LegendLines;
  /**
   * Actually selected metric
   */
  metric: MetricItem;
  /**
   * Legend description
   */
  description: LegendDescription;
  /**
   * Some metrics have discrete legend.
   * If so, these labels define it, where NumValue is numerical value, to grab color from color table
   */
  discreteLegend?: {
    /**
     * Should all items in legend have same width?
     */
    hasEqualItemsWidth?: boolean;
    /**
     * Array of trans strings and clored string.
     *
     * For simplicity of sloution, the legned colors are hardcoded
     * thus they do not react on 'users' defined color. This will
     * be know bug and we will not handle this case.
     */
    labels: [keyof LoadedTranslations, RGBString][];
  };
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
  abstract convertNumber(value: NumValue, forcedPrecision?: number, metric?: MetricItem): T;
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
  /** color object is required for classic gradient metrics, discrete ones do not need it as colors are hardcoded for them */
  renderLegend(col: Color | undefined, el: HTMLDivElement, legend: Legend): void;
  protected initProperties(): void;
  private onMetricChanged;
  private getDefault;
  private setDefault;
  private getGradientLegend;
  private renderDiscreteLegend;
  private createKey;
}
