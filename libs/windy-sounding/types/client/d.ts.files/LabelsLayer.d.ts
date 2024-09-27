import { Timestamp } from '@windy/types.d';

type CityDivId = string; // `${x}:${y}`
type CityLabelId = string; // `${lat}/${lon}`

/** Loaded forecast data from `/citytile/*` URL endpoint */
export type CityForecastData = {
  /**
   * Forecasted temperatures for cities on the tile
   */
  forecast: {
    /**
     * Keys (coordinates) are in "lat/lon" format, value the forecasted temperature
     */
    [coordinates: string]: number[];
  };
  /** Reftime */
  reftime: Timestamp;
  /** Time from reftime in hours for every temperature value in the returned array */
  hours: number[];
};

/**
 * Loaded labels data from tiles.windy.com endpoint
 * Format of inner arrays is [id, title to show, category of label used for CSS class, lon, lat, width in px, height in px]
 */
export type CityLabelData = [string, string, string, number, number, number, number][];

/** Represantation of single one HTML label with its temperature data */
export interface CityLabel {
  /** Id of the label, it is same as a key for CityForecastData, so it is used for pairing label with temperature data */
  id: CityLabelId;

  /** HTML element of the label for binding labels and temperature values */
  el: HTMLDivElement;

  /** Forecast data with temperature in K, it is lazy loaded with forecast request */
  data?: number[];
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
