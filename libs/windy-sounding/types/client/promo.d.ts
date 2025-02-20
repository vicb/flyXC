import type { Timestamp } from '@windy/types';
export interface PromoInfoObject {
  id: string;
  displayed: number;
  ts: Timestamp;
}
/**
 * Get basic info about promo for given ident
 */
export declare const getCounter: (id: string) => Promise<PromoInfoObject>;
/**
 * Increases 'seen' counter for particular promo
 */
export declare const hitCounter: (id: string) => Promise<void>;
/**
 * Flag the promo to be never seen again (by setting
 * its number to 1000)
 *
 * @param ident Ident
 */
export declare const neverSee: (ident: string) => void;
