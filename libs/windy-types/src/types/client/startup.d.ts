/**
 *
 * # @windy/startup
 *
 * Controls display of startup elements
 *
 * @module startup
 */
import type { GeolocationInfo, HomeLocation } from '@windy/interfaces.d';
/**
 * Capture an event so that the HP window is cleverly hidden, but
 * at the same time trigger a user action (e.g. opening a menu, etc.)
 */
export declare function addDefaultListeners(): void;
/**
 * Show the weather box on HP
 *
 * Priority of display on HP is like this:
 *
 *  1. HP weather - always displayed (contains embedded CAP alerts)
 *
 *  2. Live alerts - displayed if there are any for users location
 *
 *  3. Published article
 *
 *  4. Our custom promos
 *
 *  5. Pin to homepage - always displayed only if user has any pinned favorites
 *
 * @param coords At which location show the HP
 */
export declare function showStartupElements(coords: HomeLocation | GeolocationInfo): Promise<void>;
export declare const closeAllStartupPlugins: (includingPermanentElements?: boolean) => void;
/**
 * Hides, the weather DIV
 *
 * @param ev Event that initiated hiding
 */
export declare function hideStartupElements(): void;
/**
 * Click on title or home button
 */
export declare function back2home(): Promise<void>;
export declare const shouldHideStartupElements: () => boolean;
export declare const unsetShouldBeHidden: () => boolean;
