import type { CityForecastData } from '@windy/LabelsLayer.d';
import type { DataHash, LatLon, MeteogramDataPayload, WeatherDataPayload } from '@windy/interfaces.d';
import type { Pois, Products } from '@windy/rootScope.d';
import type { ExtendedStationType } from '@windy/types';
import type { HttpOptions, HttpPayload } from './http';
interface LatLonStep extends LatLon {
  step?: number;
  interpolate?: boolean;
}
/**
 * @ignore
 */
export declare const getReftimeIso: (model: Products) => any;
/**
 * Returns URL for webcam detail by id
 *
 * @param id Webcam id
 * @returns URL for getting the webcam
 * @ignore
 */
export declare const getWebcamDetailUrl: (id: string | number) => string;
/**
 * Returns URL for webcam list nearby lat and lon
 *
 * @param latLon Object with `lat` and `lon` properties
 * @returns URL for getting list of webcams nearby lat and lon
 * @ignore
 */
export declare const getWebcamsListUrl: <
  T extends LatLon & {
    limit?: number;
  },
>({
  lat,
  lon,
  limit,
}: T) => string;
/**
 * Returns URL for webcam archive by id
 *
 * @param id Webcam id
 * @returns URL for getting webcam archive
 * @ignore
 */
export declare const getWebcamArchiveUrl: (id: string | number, hourly?: boolean) => string;
/**
 * Returns URL for searching webcam views using Google maps places
 *
 * @param {string} textQuery search query
 * @param {LatLon} [latLon] circle center coordinates
 * @returns {string} URL for searching webcam views
 * @ignore
 */
export declare const getSearchWebcamViewsUrl: (textQuery: string, latLon?: LatLon) => string;
/**
 * Returns URL for webcam metric. It increases counter for the ID on backend.
 *
 * @param id Webcam id
 * @returns URL for ping webcam metrics
 * @ignore
 */
export declare const getWebcamMetricsUrl: (id: string | number) => string;
/**
 * Gets point forecast data for given location
 *
 * @param model Forecast model
 * @param params LalLon of the location and additional parameters
 * @param pointForecastOptions Additional options of point forecast API
 * @param httpOptions Additional HTTP options
 * @returns Promise with HTTP payload
 */
export declare const getPointForecastData: <T extends LatLonStep>(
  model: Products,
  { lat, lon, step, interpolate }: T,
  pointForecastOptions?: Record<string, string>,
  httpOptions?: HttpOptions,
) => Promise<HttpPayload<WeatherDataPayload<DataHash>>>;
/**
 * Gets enhanced point forecast meteogram data for given location
 * @returns Promise with HTTP payload
 */
export declare const getMeteogramForecastData: <T extends LatLonStep>(
  model: Products,
  { lat, lon, step }: T,
  pointForecastOptions?: Record<string, string>,
  options?: HttpOptions,
) => Promise<HttpPayload<MeteogramDataPayload>>;
/**
 * Returns URL for getting archive forecast
 * @ignore
 */
export declare const getArchiveForecastData: <T extends LatLon>(
  model: Products,
  { lat, lon }: T,
  source: string,
  qs?: string,
  options?: HttpOptions,
) => Promise<HttpPayload<WeatherDataPayload<DataHash>>>;
/**
 * Returns URL for getting citytile forecast
 *
 * @param model Forecast model
 * @param frag Mercator frag in {z}/{x}/{y} format
 * @param options HTTP options
 * @returns URL for getting citytile forecast
 * @ignore
 */
export declare const getCitytileData: (
  model: Products,
  frag: string,
  options?: HttpOptions,
) => Promise<HttpPayload<CityForecastData> | null>;
/**
 * Returns URL for nearest POI items (stations, airQ, ...)
 * @param param0
 * @returns URL for getting nearest POI items
 * @ignore
 */
export declare const getNearestPoiItemsUrl: (type: Pois | 'stations', { lat, lon }: LatLon) => string;
/**
 * Returns URL for tide forecast
 * @ignore
 */
export declare const getTideForecastUrl: <T extends LatLonStep>({ lat, lon }: T) => string;
/**
 * Returns URL for tide POI
 * @ignore
 */
export declare const getTidePoiUrl: (id: string) => string;
/**
 * Get observations URL
 * @ignore
 */
export declare const getObservationsUrl: (
  type: ExtendedStationType,
  id: string,
  daysFrom: number,
  daysTo?: number,
) => string;
export {};
