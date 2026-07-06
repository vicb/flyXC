/**
 * # @windy/fetch
 *
 * Basic HTTP requests for getting URLs of our
 * backend services or fetching data from Windy API.
 * Although it works as wrapper around our {@link http} module,
 * it ensures standardized way of fetching data.
 *
 * @module fetch
 */
import * as http from '@windy/http';
import type { CityTemperaturesDto } from '@windy-types/citytile2';
import type { DataHash, LatLon, MeteogramDataPayload, WeatherDataPayload, CapAlertHeadline, ActiveStormCountPayload, AirQDataHash, TZinfo } from '@windy/interfaces.d';
import type { Pois, Products } from '@windy/rootScope.d';
import type { SatelliteInfoJson } from '@windy/satellite.d';
import type { RadarMinifest } from '@plugins/radar-plus/types';
import type { ExtendedStationType, Pixel, StationOrPoiType, NumValue } from '@windy/types';
import type { OSMMapBounds } from '@plugins/search/search.d';
import type { HttpOptions, HttpPayload, QueryStringSource } from '@windy/http.d';
import type { StormListJSON } from '@plugins/shared/hurricanes/types';
import type { LiveAlertEvent } from '@plugins/startup-live-alerts/startup-live-alerts';
import type { WhatsNewObsolete, WhatsNewData } from '@windy/startup.d';
import type { ArticleStartupData } from '@plugins/articles/articles';
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
export declare const getWebcamsListUrl: <T extends LatLon & {
    limit?: number;
}>({ lat, lon, limit, }: T) => string;
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
export declare const getPointForecastUrl: <T extends LatLonStep>(model: Products, { lat, lon, step, interpolate }: T, pointForecastOptions?: Record<string, string>) => Promise<string>;
/**
 * Gets point forecast for NOWcast data for given location
 *
 * @param model Forecast model
 * @returns Promise with HTTP payload
 */
export declare const getNowPointForecastUrl: (model: Products, { lat, lon }: LatLon) => Promise<string>;
/**
 * Gets point forecast data for given location
 *
 * @param model Forecast model
 * @param params LalLon of the location and additional parameters
 * @param pointForecastOptions Additional options of point forecast API
 * @param httpOptions Additional HTTP options
 * @returns Promise with HTTP payload
 */
export declare const getPointForecastData: <K extends DataHash | AirQDataHash = DataHash, T extends LatLonStep = LatLonStep>(model: Products, latLonStepInterpolate: T, pointForecastOptions?: Record<string, string>, httpOptions?: HttpOptions) => Promise<http.HttpPayload<WeatherDataPayload<K>>>;
/**
 * Gets enhanced point forecast meteogram data for given location
 * @returns Promise with HTTP payload
 */
export declare const getMeteogramForecastUrl: <T extends LatLonStep>(model: Products, { lat, lon, step }: T, pointForecastOptions?: Record<string, string>) => Promise<string>;
/**
 * Gets enhanced point forecast meteogram data for given location
 * @returns Promise with HTTP payload
 */
export declare const getMeteogramForecastData: <T extends LatLonStep>(model: Products, latLonStep: T, pointForecastOptions?: Record<string, string>, httpOptions?: HttpOptions) => Promise<HttpPayload<MeteogramDataPayload>>;
/**
 * Returns URL for getting citytile forecast
 *
 * @param model Forecast model
 * @param frag Mercator frag in {z}/{x}/{y} format
 * @returns URL for getting citytile forecast
 * @ignore
 */
export declare const getCitytileData: (model: Products, frag: string) => Promise<HttpPayload<CityTemperaturesDto> | null>;
/**
 * Returns URL for nearest POI items (stations, airQ, ...)
 * @param param0
 * @returns URL for getting nearest POI items
 * @ignore
 */
export declare const getNearestPoiItemsUrl: (type: Pois | 'stations', { lat, lon }: LatLon, options?: QueryStringSource) => string;
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
export declare const getObservationsUrl: (type: ExtendedStationType, id: string, daysFrom: number, daysTo?: number) => string;
/**
 * Get URL for getting observations for a specific station in node-poi server
 */
export declare const getObservationPoiUrl: (type: StationOrPoiType | 'stations' | 'metars', id: string) => string;
/**
 * Returns loading promise for cap alert headlines
 */
export declare const getCapAlertsSummary: ({ lat, lon }: LatLon, source?: 'hp' | 'detail') => Promise<http.HttpPayload<CapAlertHeadline[]>>;
export declare const getHurricanesCount: () => Promise<HttpPayload<ActiveStormCountPayload>>;
/**
 * Loads Satellite Product info
 */
export declare const getSatelliteInfo: () => Promise<HttpPayload<SatelliteInfoJson>>;
/**
 * Loads Radar Product info
 */
export declare const getRadarInfo: () => Promise<HttpPayload<RadarMinifest>>;
export declare const getRadarArchiveInfo: () => Promise<HttpPayload<RadarMinifest>>;
export declare const getSatelliteArchiveInfo: () => Promise<HttpPayload<SatelliteInfoJson>>;
export declare const getRadarCoverage: () => Promise<HttpPayload<number[]>>;
export declare const getHurricanesList: () => Promise<HttpPayload<StormListJSON>>;
/**
 * Loads elevation (AMSL meters) for given coordinates
 */
export declare const getElevation: (lat: number, lon: number, httpOptions?: HttpOptions) => Promise<HttpPayload<NumValue>>;
/**
 * Returns URL for static map image. Max zoom level is 13
 */
export declare const getStaticMapImageUrl: (params: LatLon & {
    zoom: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
    size: Pixel;
    bounds?: OSMMapBounds;
}) => string;
/**
 * Returns active live alert for given location (if any)
 */
export declare const getLiveAlerts: ({ lat, lon }: LatLon) => Promise<http.HttpPayload<{
    alerts: LiveAlertEvent[];
}>>;
/**
 * Returns a URL for retrieving radar/sat image
 */
export declare const getRadarSatImageUrl: (type: 'radar' | 'satellite', { lat, lon, w, h, format, satMode, radarMode, }: LatLon & {
    w?: Pixel;
    h?: Pixel;
    format?: 'webp' | 'jpg';
    satMode?: 'infra' | 'infraplus' | 'blue' | 'visible' | 'grey' | 'irbt';
    radarMode?: 'default' | 'radarplus';
}) => string;
export declare const getArticle: (latLon: LatLon) => Promise<HttpPayload<ArticleStartupData>>;
export declare const getWhatsNew: (latLon: LatLon) => Promise<HttpPayload<WhatsNewObsolete | WhatsNewData>>;
export declare const getTimezoneInfo: (location: LatLon, datetime: string) => Promise<HttpPayload<TZinfo>>;
export {};
