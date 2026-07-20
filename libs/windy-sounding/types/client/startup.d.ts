/**
 *
 * # @windy/startup
 *
 * Controls display of startup elements
 *
 * @module startup
 */
import type { GeolocationInfo, HomeLocation } from './d.ts.files/interfaces.d';
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
 *  2. If applicable fires whats-new or display app is obsolete
 *
 *  3. Live alerts - displayed if there are any for users location
 *
 *  4. Published article
 *
 *  5. Our custom promos
 *
 *  6. Pin to homepage - always displayed only if user has any pinned favorites
 *
 * @param coords At which location show the HP
 */
export declare function showStartupElements(coords: HomeLocation | GeolocationInfo): Promise<void>;
export declare const searchBetterLocation: (this: unknown, ...args: [] & unknown[]) => void;
export declare const closeAllStartupPlugins: (includingPermanentElements?: boolean) => void;
/**
 * Hides, the weather DIV
 *
 * @param ev Event that initiated hiding
 */
export declare function hideStartupElements(ev?: MouseEvent | KeyboardEvent | TouchEvent): void;
/**
 * Click on title or home button
 */
export declare function back2home(): Promise<void>;
export declare const shouldHideStartupElements: () => boolean;
export declare const unsetShouldBeHidden: () => boolean;
