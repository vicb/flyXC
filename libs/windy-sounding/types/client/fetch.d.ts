import type { CityTemperaturesDto } from '@windy-types/citytile2';
import type {
  DataHash,
  LatLon,
  MeteogramDataPayload,
  WeatherDataPayload,
  ActiveStormCountPayload,
} from '@windy/interfaces.d';
import type { Pois, Products } from '@windy/rootScope.d';
import type { ExtendedStationType, StationOrPoiType } from '@windy/types';
import type { HttpOptions, HttpPayload, QueryStringSource } from './http.d';
interface LatLonStep extends LatLon {
  step?: number;
  interpolate?: boolean;
}
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
 * Gets point forecast data URL for given location
 *
 * @param model Forecast model
 * @param params LalLon of the location and additional parameters
 * @param pointForecastOptions Additional options of point forecast API
 * @param httpOptions Additional HTTP options
 * @returns URL string for getting point forecast data
 */
export declare const getPointForecastUrl: <T extends LatLonStep>(
  model: Products,
  { lat, lon, step, interpolate }: T,
  pointForecastOptions?: Record<string, string>,
) => Promise<string>;
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
  latLonStepInterpolate: T,
  pointForecastOptions?: Record<string, string>,
  httpOptions?: HttpOptions,
) => Promise<HttpPayload<WeatherDataPayload<DataHash>>>;
/**
 * Gets enhanced point forecast meteogram data for given location
 * @returns Promise with HTTP payload
 */
export declare const getMeteogramForecastUrl: <T extends LatLonStep>(
  model: Products,
  { lat, lon, step }: T,
  pointForecastOptions?: Record<string, string>,
) => Promise<string>;
/**
 * Gets enhanced point forecast meteogram data for given location
 * @returns Promise with HTTP payload
 */
export declare const getMeteogramForecastData: <T extends LatLonStep>(
  model: Products,
  latLonStep: T,
  pointForecastOptions?: Record<string, string>,
  httpOptions?: HttpOptions,
) => Promise<HttpPayload<MeteogramDataPayload>>;
/**
 * Returns URL for getting citytile forecast
 *
 * @param model Forecast model
 * @param frag Mercator frag in {z}/{x}/{y} format
 * @returns URL for getting citytile forecast
 * @ignore
 */
export declare const getCitytileData: (
  model: Products,
  frag: string,
) => Promise<HttpPayload<CityTemperaturesDto> | null>;
/**
 * Returns URL for nearest POI items (stations, airQ, ...)
 * @param param0
 * @returns URL for getting nearest POI items
 * @ignore
 */
export declare const getNearestPoiItemsUrl: (
  type: Pois | 'stations',
  { lat, lon }: LatLon,
  options?: QueryStringSource,
) => string;
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
/**
 * Get URL for getting observations for a specific station in node-poi server
 */
export declare const getObservationPoiUrl: (type: StationOrPoiType | 'stations', id: string) => string;
/**
 * Returns http promise for active hurricanes count
 */
export declare const getHurricanesCount: () => Promise<HttpPayload<ActiveStormCountPayload>>;
export {};
