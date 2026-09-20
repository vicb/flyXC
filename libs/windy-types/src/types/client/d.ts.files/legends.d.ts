import type { MetricItem } from '@windy/Metric.d';
import type { LoadedTranslations, RGBString } from '@windy/types.d';

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

export interface Legend {
    isDiscrete?: false;

    /**
     * Legend description
     */
    description: LegendDescription;

    /**
     * Array defining how the legend will look like
     */
    lines: LegendLines;
}

export interface DiscreteLegend {
    isDiscrete: true;

    /**
     * Should all items in legend have same width?
     */
    hasEqualItemsWidth?: boolean;

    /**
     * Array of trans strings and clored string.
     *
     * For simplicity of solution, the legned colors are hardcoded
     * thus they do not react on 'users' defined color. This will
     * be know bug and we will not handle this case.
     */
    labels: [keyof LoadedTranslations, RGBString][];
}
