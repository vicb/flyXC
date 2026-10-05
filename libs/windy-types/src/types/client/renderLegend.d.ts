import type { MetricItem } from '@windy/Metric.d';
import type { HTMLString } from '@windy/types.d';
import type { DiscreteLegend, Legend } from '@windy/legends.d';
import type { Color, PrecomputedGradient } from '@windy/Color';
export type RenderedLegend = {
    background: string;
    content: HTMLString;
};
export declare function renderLegend(el: HTMLDivElement, legend: Legend | DiscreteLegend, color?: Color, selectedMetric?: MetricItem): void;
export declare function getGradientLegendHTML(col: PrecomputedGradient, legend: Legend, metric?: MetricItem, disableLegendTicks?: boolean): RenderedLegend;
export declare function getDiscreteLegendHTML(legend: DiscreteLegend, disableLegendTicks?: boolean): RenderedLegend;
