import type { Fav, FavId } from '@windy/favs';
export declare const emitChange: () => void;
/**
 * Adds a fav to the db
 */
export declare const add: () => Promise<FavId | null>;
/**
 * Update Fav in the db
 */
export declare const update: () => Promise<FavId | null>;
/**
 * Remove fav from db
 */
export declare const remove: () => Promise<void>;
/**
 * Toggle pinning fav to top or to homepage
 */
export declare const togglePin: () => Promise<void>;
/**
 * Find all favs that match given criteria
 */
export declare const find: () => Promise<Fav[]>;
/**
 * Same as find but always returns only the first match
 */
export declare const findOne: () => Promise<Fav | undefined>;
/**
 * Returns all favs as array
 */
export declare const getAll: () => Promise<Fav[]>;
/**
 * Quick check if fav with given ids exists
 */
export declare const isFav: () => Promise<boolean>;
/**
 * Toggles fav (adds or removes) from db
 */
export declare const toggle: () => Promise<boolean>;
/**
 * Checks if fav exists
 */
export declare const hasKey: () => Promise<boolean>;
/**
 * Removes all favs from the device TODO: Call after logging out
 */
export declare const removeAllFavsFromDevice: () => Promise<void>;
