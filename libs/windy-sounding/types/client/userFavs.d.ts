import type { FavFragment, Fav, FavId } from '@windy/favs.d';
import type { Timestamp } from '@windy/types.d';
export declare const emitChange: () => void;
/**
 * Adds a fav to the db
 */
export declare const add: (item: FavFragment) => Promise<FavId | null>;
/**
 * Update Fav in the db
 */
export declare const update: (id: FavId, properties2update: Partial<Fav>) => Promise<FavId | null>;
/**
 * Remove fav from db
 */
export declare const remove: (id: FavId) => Promise<void>;
/**
 * Toggle pinning fav to top or to homepage
 */
export declare const togglePin: (
  id: FavId,
  whereToPin: 'pin2top' | 'pin2homepage',
  forcedTimestamp?: Timestamp,
) => Promise<void>;
/**
 * Find all favs that match given criteria
 */
export declare const find: (query: Partial<Fav> | ((f: Fav) => boolean)) => Promise<Fav[]>;
/**
 * Same as find but always returns only the first match
 */
export declare const findOne: (query: Partial<Fav> | ((f: Fav) => boolean)) => Promise<Fav | undefined>;
/**
 * Returns all favs as array
 */
export declare const getAll: () => Promise<Fav[]>;
/**
 * Quick check if fav with given ids exists
 */
export declare const isFav: (query: Partial<FavFragment>) => Promise<boolean>;
/**
 * Toggles fav (adds or removes) from db
 */
export declare const toggle: (query: Partial<FavFragment>, item: FavFragment) => Promise<boolean>;
/**
 * Checks if fav exists
 */
export declare const hasKey: (key: FavId) => Promise<boolean>;
/**
 * Removes all favs from the device TODO: Call after logging out
 */
export declare const removeAllFavsFromDevice: () => Promise<void>;
