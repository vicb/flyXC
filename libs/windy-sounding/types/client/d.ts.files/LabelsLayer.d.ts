import { Timestamp, type NumOrNull } from '@windy/types.d';

type CityDivId = string; // `${x}:${y}`
type CityLabelId = string; // `${lat}/${lon}`

/**
 * Loaded labels data from tiles.windy.com endpoint
 * Format of inner arrays is [id, title to show, category of label used for CSS class, lon, lat, width in px, height in px]
 */
export type CityLabelData = [string, string, string, number, number, number, number][];

/** Represantation of single one HTML label with its temperature data */
export interface CityLabel {
  /** Id of the label, it is same as a key for `CityTemperaturesDto`, so it is used for pairing label with temperature data */
  id: CityLabelId;

  /** HTML element of the label for binding labels and temperature values */
  el: HTMLDivElement;

  /** Forecast data with temperature in K, it is lazy loaded with forecast request */
  data?: NumOrNull[];
}

/** Representation of one leaflet tile with its CityLabels */
export interface CityDiv {
  /** Labels included in the leaflet tile */
  labels: CityLabel[];

  /** Mercator URL frag in format <z>/<x>/<y>. It is lazy binded when tile is created */
  urlFrag?: string;

  /* Array of timestamps for which the temperatures are forecasted. Lazy loaded with forecast request */
  timestamps?: Timestamp[];
}
