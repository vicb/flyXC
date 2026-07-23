import type { MetricItem } from '@windy/Metric.d';
import type { DiscreteLegend, Legend } from '@windy/legends.d';
import type { Color } from '@windy/Color';
export declare function renderLegend(
  el: HTMLDivElement,
  legend: Legend | DiscreteLegend,
  color?: Color,
  selectedMetric?: MetricItem,
): void;
