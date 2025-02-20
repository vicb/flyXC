/**
 *
 * # @windy/startupWeather
 *
 * Controls display & hiding of 4 days weather on Windy after startup
 *
 * GUI on desktop works in two different modes:
 *
 *  1. Default mode - user has NO pinned favs on HP or has any, but do not want to see them permanently
 *
 *  2. Persistent mode (desktop only) - user has pinned favs on HP and wants to see them permanently
 *
 *  Both modes use completely different set of listeners that handle hide / show of HP weather
 *
 * @module startupWeather
 */
/**
 * Hides, the weather DIV
 *
 * @param ev Event that initiated hiding
 */
export declare function hide(ev?: MouseEvent | KeyboardEvent | TouchEvent): Promise<void>;
/**
 * Click on title or home button
 */
export declare function back2home(): Promise<void>;
export declare const getCancelShow: () => boolean;
