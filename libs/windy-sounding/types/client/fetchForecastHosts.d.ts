/**
 * # @windy/fetchNodeForecast
 *
 * HTTP requests for fetching data from Windy NODE_FORECAST API endpoints.
 *
 * @module fetchNodeForecast
 */
import * as http from '@windy/http';
import type { LatLon } from '@windy/interfaces.d';
import type { PointProducts, Products } from '@windy/rootScope.d';
import type { DetailDisplayType, ISODateString } from '@windy/types';
import type { HttpOptions, HttpPayload } from '@windy/http.d';
import type { IncludeInFragmentQueryString, IncludeInQueryString, AirQDataHash2, AllPossibleDataHashes2, DataHash2, FragmentDataPayload, WeatherDataPayload2 } from '@windy/node-forecast-v3.d';
export interface PointForecastOptions extends LatLon {
    /**
     * Hour step
     */
    step?: 1 | 3;
    /**
     * How many days to fetch
     */
    days?: number;
    /**
     * Optional source of query
     */
    source?: 'detail' | 'detail-preload' | 'hp' | 'favs' | 'favs-on-top' | 'alerts' | 'embedded-meteogram' | 'multiload';
}
export declare const getReftimeIso: (model: Products) => Promise<ISODateString | undefined>;
/**
 * Gets point forecast for NOWcast data for given location
 * @deprecated
 *
 * @param model Forecast model
 * @returns Promise with HTTP payload
 */
export declare const getNowPointForecastUrl: (model: PointProducts, { lat, lon }: LatLon) => Promise<string>;
/**
 * Gets point forecast data for given location
 */
export declare const getPointForecastData: <K extends DataHash2 | AirQDataHash2 = DataHash2>(model: PointProducts, { lat, lon, step, days: requiredDays, source }: PointForecastOptions, includeInQueryString?: IncludeInQueryString | undefined | null, httpOptions?: HttpOptions) => Promise<http.HttpPayload<WeatherDataPayload2<K>>>;
export interface DetailPointForecastOptions extends LatLon {
    model: PointProducts;
    days: number;
    step: 1 | 3;
    display?: DetailDisplayType;
    extended?: boolean;
}
/**
 * Gets point forecast data specifically for the detail plugin.
 * Encapsulates the includes and days logic so it doesn't have to be duplicated
 * in beforeLoad (preload) and MainTable (render).
 */
export declare const getDetailPointForecastData: (options: DetailPointForecastOptions) => Promise<HttpPayload<WeatherDataPayload2<AllPossibleDataHashes2>>>;
/**
 * Gets point forecast data for given location
 */
export declare const getPointForecastFragmentData: ({ lat, lon, days, source }: PointForecastOptions, includeInQueryString?: IncludeInFragmentQueryString | undefined | null, model?: PointProducts | undefined, httpOptions?: HttpOptions) => Promise<HttpPayload<FragmentDataPayload>>;
/**
 * Loads forecast archive and always resolves
 */
export declare const loadForecastArchive: (model: PointProducts, selRange: number, latLon: LatLon, source?: string, abortSignal?: AbortSignal) => Promise<DataHash2 | null>;
