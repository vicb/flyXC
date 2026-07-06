import type { Products } from '@windy/rootScope.d';
import type { ISODateString, Path, Timestamp, LoadedTranslations } from '@windy/types.d';
/**
 * Main minifest object received from backend
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
     * Main identifier, identifying the refTime on the backend.
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
     * Translation ID for week day one letter/symbol abbreviation
     */
    displayShort: keyof LoadedTranslations;
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
     * Forecast for this day is for Premium users only
     */
    premium: boolean;
    /**
     * Forecast for this day is available
     */
    hasForecast: boolean;
}
/**
 * Valid translation keys
 */
export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
export type CalendarInitParams = {
    /**
     * Minifest that led to construction of this instance
     */
    minifest: MinifestObject;
    /**
     * Ident of product that this calendar is created for
     */
    productIdent: Products;
    /**
     * This product is a free product
     */
    freeProduct?: boolean;
    /**
     * Minimum number of hours this calendar should cover
     */
    minimumHours: number;
};
export declare class Calendar {
    static readonly weekdays: Weekday[];
    /**
     * At what day we start premium forecast
     */
    private premiumStartDay;
    /**
     * Ident of a product that this Calendar is associated with (just for debug purposes)
     */
    private productIdent;
    /**
     * Number of hours in the calendar
     */
    calendarHours: number;
    /**
     * Today midnight in LT of user's computer
     */
    midnight: Date;
    /**
     * startOfTimeline in the form of timestamp
     */
    start: Timestamp;
    /**
     * startOfPremiumTimeline in the form of timestamp; null if it is free in whole range
     */
    premiumStart: Timestamp | null;
    /**
     * endOfPremiumTimeline in the form of timestamp; null if it is free in whole range
     */
    premiumEnd: Timestamp | null;
    /**
     * endOfCalendar as timestamp
     */
    endOfCal: Timestamp;
    /**
     * endOfCal or latest timestamp, whoever is smaller
     */
    end: Timestamp;
    /**
     * Array of calendar days to be used in UI
     */
    days: CalendarDay[];
    /**
     * Array of timestamps that contain valid forecast
     */
    timestamps: Timestamp[];
    /**
     * Array of URL paths that equal to timestamps in a form of "2021/05/27/19"
     */
    paths: Path[];
    /**
     * Forecast update time
     */
    updateTs: Timestamp;
    /**
     * Minifests's reference time
     */
    refTimeTs: Timestamp;
    constructor({ productIdent, minifest, freeProduct, minimumHours }: CalendarInitParams);
    /**
     * Bound ts to be be within limit of calendar
     */
    boundTs(ts: Timestamp): Timestamp;
    /**
     * Finds closes valid path on the basis of timestamp
     */
    ts2path(ts: Timestamp): Path;
    private createDays;
    private createTimestamps;
    /**
     * Adds hours or days to date
     *
     * @example
     * date = this.add( new Date(), 13, 'days' )
     */
    private add;
    /**
     * Return nearest midnight
     */
    static getMidnight(ts?: number): Date;
}
