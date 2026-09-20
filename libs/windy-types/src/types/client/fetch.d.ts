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
import type { LatLon, CapAlertHeadline, ActiveStormCountPayload, TZinfo, NativeAppsReleaseInfo } from '@windy/interfaces.d';
import type { RadarMinifest } from '@plugins/radar-plus/types';
import type { Pois, Products } from '@windy/rootScope.d';
import type { SatelliteCompositeJson, SatelliteRangeJson } from '@windy/satellite.d';
import type { ExtendedStationType, NumValue, Pixel, StationOrPoiType } from '@windy/types';
import type { OSMMapBounds } from '@plugins/search/search.d';
import type { HttpOptions, HttpPayload, QueryStringSource } from '@windy/http.d';
import type { StormListJSON } from '@plugins/shared/hurricanes/types';
import type { LiveAlertEvent } from '@plugins/startup-live-alerts/startup-live-alerts';
import type { ArticlePromoData, ArticleStartupData } from '@plugins/articles/articles';
export * from '@windy/fetchWebcamsHosts';
export * from '@windy/fetchForecastHosts';
/**
 * @deprecated Legacy `forecast/meteogram` v1.2 endpoint, superseded by the v3 `meteogram`
 * include. Left untyped since nothing in this codebase consumes the response anymore.
 *
 * Used in external plugin (Contrail Finder), remove after the plugin is migrated to v3 meteogram.
 */
export declare const getMeteogramForecastData: (model: Products, { lat, lon, step }: LatLon & {
    step?: number;
}, pointForecastOptions?: Record<string, string>, httpOptions?: HttpOptions) => Promise<HttpPayload<any>>;
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
export declare const getTideForecastUrl: ({ lat, lon }: LatLon) => string;
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
export declare const getSatelliteCompositeInfo: () => Promise<HttpPayload<SatelliteCompositeJson>>;
export declare const getSatelliteArchiveRangeInfo: () => Promise<HttpPayload<SatelliteRangeJson>>;
/**
 * Loads Radar Product info
 */
export declare const getRadarInfo: () => Promise<HttpPayload<RadarMinifest>>;
export declare const getRadarArchiveInfo: () => Promise<HttpPayload<RadarMinifest>>;
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
export declare const getPromo: (latlon: LatLon, forcedPromoId?: string) => Promise<HttpPayload<ArticlePromoData>>;
export declare const getTimezoneInfo: (location: LatLon, datetime: string) => Promise<HttpPayload<TZinfo>>;
export declare const getLatestJson: () => Promise<http.HttpPayload<NativeAppsReleaseInfo>>;
