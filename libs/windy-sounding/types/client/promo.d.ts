import type { ISODateString, Timestamp, TimeRangeMs } from '@windy/types';
type PromoUniqueId = string;
export interface PromoInfoObject {
  id: PromoUniqueId;
  displayed: number;
  ts: Timestamp;
}
/**
 * Get basic info about promo for given ident
 */
export declare const getCounter: (id: PromoUniqueId) => Promise<PromoInfoObject>;
/**
 * Increases 'seen' counter for particular promo
 */
export declare const hitCounter: (id: PromoUniqueId, logEvent?: boolean) => Promise<void>;
/**
 * Flag the promo to be never seen again (by setting
 * its number to 1000)
 *
 * @param ident Ident
 */
export declare const neverSee: (ident: PromoUniqueId) => void;
/**
 * Determines if promo should be displayed or not
 */
export declare const shouldDisplayPromo: ({
  id,
  end,
  counter,
  delay,
}: {
  /**
   * Main ID of the promo. This key is also used in `promo` object in localStorage
   */
  id: PromoUniqueId;
  /**
   * ISO date, when the promo expires
   */
  end?: ISODateString;
  /**
   * How many times display promo to the user (respective on one device)
   */
  counter: number;
  /**
   * How often to display promo on particular device (in ms)
   */
  delay?: TimeRangeMs;
}) => Promise<boolean>;
export {};
