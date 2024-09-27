import { LoadedTranslations } from '@windy/trans.d';
import { Timestamp, ISODateString } from '@windy/types.d';

/**
 * Main minifest object. Mother of all forecasts
 */
export interface MinifestObject {
  /**
   * Version
   */
  v: string;

  /**
   * Array of hour moments that contain forecast data
   */
  dst: number[][];

  /**
   * Main identifier, identifiing the refTime on the backend.
   */
  info: string;

  /**
   * Reference time of forecast
   */
  ref: ISODateString;

  /**
   * Update time of the forecast
   */
  update: ISODateString;

  /**
   * In an emergency case backend can set `force` property at minifest. It breaks minifest client cache and set minifest at any circumstances
   */
  forced?: boolean;
}

/**
 * Main Calendar Day Object
 */
export interface CalendarDay {
  /**
   * Translation ID for week day abbreviation
   */
  display: keyof LoadedTranslations;

  /**
   * Translation ID for week day abbreviation
   */
  displayLong: keyof LoadedTranslations;

  /**
   * Start of the day
   */
  start: Timestamp;

  /**
   * End of the day
   */
  end: Timestamp;

  /**
   * Midday of the day
   */
  middayTs: Timestamp;

  /**
   * Day of the month
   */
  day: number;

  /**
   * month
   */
  month: number;

  /**
   * year
   */
  year: number;
}

/**
 * Valid translation keys
 */
export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
