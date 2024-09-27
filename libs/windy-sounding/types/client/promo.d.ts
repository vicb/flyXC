import type { StorageData } from '@windy/storage.d';
export interface PromoInfoObject {
  displayed: number;
  ts: number;
}
/**
 * Get raw promo object from localStorage
 *
 * @returns Local promos
 */
export declare const getAll: () => StorageData['promos2'];
/**
 * Get basic info about promo
 *
 * @param ident Identification
 * @returns Promo info object
 */
export declare const getCounter2: (ident: string) => PromoInfoObject;
/**
 * Increases 'seen' counter for particular promo
 *
 * @param ident Ident
 */
export declare const hitCounter: (ident: string) => void;
/**
 * Flag the promo to be never seen again (by setting
 * its number to 1000)
 *
 * @param ident Ident
 */
export declare const neverSee: (ident: string) => void;
