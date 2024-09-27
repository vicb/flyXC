/**
 *
 * # @windy/startupWeather
 *
 * Controls display & hiding of 4 days weather on Windy after startup
 *
 * @module startupWeather
 */
import type { GeolocationInfo, HomeLocation } from '@windy/interfaces.d';
export declare function removeListeners(): void;
/**
 * Show the weather box on HP
 *
 * @param coords At which location show the HP
 */
export declare function show(coords: HomeLocation | GeolocationInfo, displayArticles?: boolean): void;
/**
 * Hides, the weather DIV
 *
 * @param ev Event that initiated hiding
 */
export declare function hide(ev?: MouseEvent | KeyboardEvent | TouchEvent): void;
export declare const getCancelShow: () => boolean;
