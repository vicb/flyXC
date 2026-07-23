/// <reference types="svelte" />
import { HttpError } from '@windy/errors';
import type { RegistrationError } from '@capacitor/push-notifications';
import type { QueryStringSource } from '@windy/http.d';
import type { LatLon, LinearScale, TilePoint } from '@windy/interfaces.d';
import type { RGBNumValues } from '@windy/interpolatorTypes';
import type {
  ExtendedStationType,
  HTMLString,
  NumOrNull,
  NumValue,
  Path,
  Timestamp,
  TimeRangeMs,
  ParsedQueryString,
  RGBAString,
  RGBString,
  ColorGradientString,
  RGBA,
  Hours,
  YearMonthDay,
} from '@windy/types.d';
import type { Vector3 } from '@windy/math';
import type { Readable, Subscriber, Unsubscriber } from 'svelte/store';
/**
 * One second duration in ms.
 */
export declare const tsSecond: TimeRangeMs;
/**
 * One minute duration in ms.
 */
export declare const tsMinute: TimeRangeMs;
/**
 * One hour duration in ms.
 */
export declare const tsHour: TimeRangeMs;
/**
 * One day duration in ms.
 */
export declare const tsDay: TimeRangeMs;
/**
 * Long press time duration in ms.
 */
export declare const longPressTime: TimeRangeMs;
/**
 * Converts number to char
 *
 * @param  {number} num Number to convert
 * @returns Char
 */
export declare const num2char: (num: number) => string;
/**
 * Convert string to number
 *
 * @param str Input
 * @returns Number
 */
export declare const char2num: (str: string) => number;
/**
 * Size of the vector
 */
export declare const vec2size: (x: number, y: number) => number;
/**
 * Direction of the vector in degrees (0–360), snapped to given precision
 */
export declare const vec2dir: (u: number, v: number, precision?: number) => number;
/**
 * Takes {lat,lon} and returns nice string out of it (rounds coords to two decimals)
 *
 * @param latLon { lat, lon }
 * @returns Stringified lat lon
 */
export declare const latLon2str: <T extends LatLon>(latLon: T) => string;
/**
 * Converts simple string, like `e0kagi` into latLon object
 *
 * @param str String
 * @returns Object { lat, lon }
 */
export declare const str2latLon: (str: string) => LatLon;
/**
 * Reusable empty function
 */
export declare const emptyFun: () => void;
/**
 * Empty GIF
 *
 * @type {string}
 */
export declare const emptyGIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
/**
 * Checks if the given object is empty (has no keys).
 */
export declare const isEmptyObject: (obj: Record<string, unknown>) => obj is Record<string, never>;
/**
 * Check if obj is a valid obj contaning lat,lon
 * TODO - it returns true also for string coords, but guarding LatLon with only numbered coords!
 *
 * @param item Object to check
 * @returns True if it is a valid object, false otherwise
 */
export declare const isValidLatLonObj: <T>(item: LatLon | T) => item is T & LatLon;
/**
 * Normalizes lat,lon to 3decimal points (as we use in in URL and XHR)
 *
 * @param str String with coordinate
 * @returns Normalized coordinate
 */
export declare const normalizeLatLon: (str: string | number) => string;
/**
 * Just iterates dictionary
 * @deprecated Use Object.entries instead
 *
 * @param items Object to iterate
 * @param cb Callback called every single iteration
 */
export declare const each: <K extends string | number | symbol, V>(
  items: { [P in K]?: V },
  cb: (item: V, key: K) => unknown,
) => void;
/**
 * Makes a deep clone of an Object. Optional @propertis
 * can contain  list of @properties {Array} that will be copied.
 * Returns new object.
 * Usage: params = clone(rootScope,[ 'overlay','level','maps' ])
 *
 * @param source Source to clone
 * @param properties Properties to clone
 * @returns Deep copy of the source
 */
export declare const clone: <T>(source: T, properties?: (keyof T)[]) => T;
/**
 * Degrees2radians
 *
 * @param deg Degrees
 * @returns radians
 */
export declare const deg2rad: (deg: number) => number;
export declare const degToRad = 0.017453292;
export declare const radToDeg = 57.2957795;
/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @param func Function to debounce
 * @param wailTill Time limit of debouncing
 * @param immediate Should be function trigger on the leading edge or on the trailing
 * @returns Debounced function
 */
export declare const debounce: <Args extends unknown[], F extends (...args: Args) => void>(
  func: (this: ThisParameterType<F>, ...args: Args & Parameters<F>) => void,
  waitTill: number,
  immediate?: boolean,
) => (this: ThisParameterType<F>, ...args: Args & Parameters<F>) => void;
/**
 * Returns a throttled variant of the input function, using a timer to limit calls of the input function.
 * If the throttled function is called and the timer is not running, the input function is executed immediatelly and a timer is started.
 * If the throttled function is called again before the timer runs out, the input function is not executed, but the call arguments are stored
 * and the input function is called once the timer runs out.
 * If the throttled function is called multiple times while the timer is running, only the latest call arguments are used once the timer runs out.
 *
 * @param this NOT USED, it is only TS explicit this annotation build-time parameter. Consider it as the first parameter would not exist.
 * @param fn Function to throttle
 * @param time Throttle time in ms.
 * @returns Throttled function
 */
export declare const throttle: <Args extends unknown[], F extends (...argmtns: Args) => void>(
  this: ThisParameterType<F>,
  fn: (this: ThisParameterType<F>, ...argmtns: Args & Parameters<F>) => void,
  time: number,
) => (this: ThisParameterType<F>, ...argmtns: Args & Parameters<F>) => void;
/**
 * Pad leading zeroes to the number
 *
 * @param  {number} num Number to pad
 * @param  {number} size Digits (default 2)
 * @returns Padded number
 */
export declare const pad: (num: number, size?: number) => string;
/**
 * Replaces {keys} in a string by properties in @data structure
 * Usage: "confirm {num}".template({num: 5})
 *
 * @param str String with placeholders
 * @param data Values for placeholders
 * @returns String with replaced placeholders
 */
export declare const template: (str: string, data?: Record<string, unknown>) => string;
export interface DirObject {
  /** Direction of wind. Backend for POI detail can return VAR here, but it should never pass into this type */
  dir: number;
}
export interface WindObject extends DirObject {
  wind: number;
  gust?: number | null;
}
/**
 * Return magnitude and angle from U,V vectors for wind
 *
 * @param v Vector [u,v]
 * @returns Object { wind, dir }
 */
export declare const wind2obj: ([u, v]: [number, number] | RGBNumValues) => WindObject;
export interface WaveObject extends DirObject {
  period: number;
  size: number;
}
/**
 * Return magnitude, period and angle from U,V vectors for waves
 *
 * @param v Vector [u,v,size]
 * @returns Object { wind, dir, period }
 */
export declare const wave2obj: ([u, v, size]: RGBNumValues) => WaveObject;
/**
 * Trush if wx object has valid direction
 *
 * @param wx Wind object
 * @returns True if object has a valid direction, false otherwise
 */
export declare const hasDirection: <T extends Partial<WindObject>>(
  wx: T,
) => wx is {
  dir: number;
  wind: number;
} & T;
/**
 * Ruturn piece of html with rotated wind arrow
 *
 * @param wx Wind object
 * @returns HTML with oriented wind arrow
 */
export declare const windDir2html: (wx: WindObject) => HTMLString;
/**
 * Cheap function to determine that two points are near
 *
 * @param a { lat, lon }
 * @param b { lat, lon }
 * @returns True if points are near to each other, false otherwise
 */
export declare const isNear: <T extends LatLon, F extends LatLon>(a: T, b: F) => boolean;
/**
 * Clamps a number to a range
 *
 * @param num Number to clamp
 * @param min Minimum
 * @param max Maximum
 * @returns Clamped number
 */
export declare const clamp: (num: number, min: number, max: number) => number;
/**
 * Smoothstep https://en.wikipedia.org/wiki/Smoothstep
 *
 * @param min Minimum
 * @param max Maximum
 * @param value Value
 * @returns Smoothed value
 */
export declare const smoothstep: (min: number, max: number, value: number) => number;
/**
 * longitude <-180.0; 180.0> to mercator <0.0, 1.0>
 *
 * @param lon Lon value
 * @returns Mercator value of lon
 */
export declare const lonDegToXUnit: (lon: number) => number;
/**
 * Latitude <-85.05; 85.05> to mercator <1.0; 0.0>
 *
 * @param lat01 Lat value
 * @returns Mercator value of lat
 */
export declare const lat01ToYUnit: (lat01: number) => number;
/**
 * Lattitude <85.05; -85.05> to mercator <0.0; 1.0>
 *
 * @param lat Lat value
 * @returns Mercator value of lat
 */
export declare const latDegToYUnit: (lat: number) => number;
/**
 * Mercator lon to deg
 *
 * @param ux Mercator lon value
 * @returns Deg value
 */
export declare const unitXToLonDeg: (ux: number) => number;
/**
 * Mercator lat to deg
 *
 * @param uy Mercator lat value
 * @returns Deg value
 */
export declare const unitYToLatDeg: (uy: number) => number;
/**
 * Mercator lon to rad <0;1> => <-PI;PI>
 *
 * @param ux Mercator lon value
 * @returns Rad value
 */
export declare const unitXToLonRad: (ux: number) => number;
/**
 * Mercator lat to rad <0;1> => <-PI;PI>
 *
 * @param uy Mercator lat value
 * @returns Rad value
 */
export declare const unitYToLatRad: (uy: number) => number;
/**
 * Returns adjusted Date.now()
 *
 * @param syncTime Synchronization value (ts from server)
 * @returns Current time
 */
export declare const getAdjustedNow: (syncTime?: number) => number;
/**
 * Is valid lang ISO string (the one we have translated?)
 *
 * @param lang Language code
 * @returns True if language is supported, false otherwise
 */
export declare const isValidLang: (
  lang: string,
) => lang is
  | 'en'
  | 'zh-TW'
  | 'zh'
  | 'ja'
  | 'fr'
  | 'ko'
  | 'it'
  | 'ru'
  | 'nl'
  | 'cs'
  | 'tr'
  | 'pl'
  | 'sv'
  | 'fi'
  | 'ro'
  | 'el'
  | 'hu'
  | 'hr'
  | 'ca'
  | 'da'
  | 'ar'
  | 'fa'
  | 'hi'
  | 'ta'
  | 'sk'
  | 'uk'
  | 'bg'
  | 'he'
  | 'is'
  | 'lt'
  | 'et'
  | 'vi'
  | 'sl'
  | 'sr'
  | 'id'
  | 'th'
  | 'sq'
  | 'pt'
  | 'nb'
  | 'es'
  | 'de'
  | 'bn';
/**
 * Safely joins server name and path
 *
 * @param url1 URL to join
 * @param url2 URL to join
 * @returns Joined URL
 */
export declare const joinPath: (url1: string, url2: string) => string;
/**
 * Safelly adds query string to url
 *
 * @param url URL to which the query should be attached
 * @param query Query to attach
 * @returns Complete URL
 */
export declare const addQs: (url: string, query: string) => string;
/**
 * Creates query string out of an key value pairs
 *
 * @param tokensObj Object from which the query should be created
 * @returns key1=value1&key2=value2&...
 */
export declare const qs: (tokensObj: QueryStringSource) => string;
/**
 * Loads .js file by appendig it as script element appended to the <head> section of the page
 *
 * @param  {string} url URL of script to be loaded
 * @param callback Callback to be called on HTML script element (WARNING: it is not called on script load)
 * @returns
 */
export declare const loadScript: (url: string, callback?: (s: HTMLScriptElement) => void) => Promise<void>;
/**
 * Copy object to clipboard
 *
 * @param str String to copy into clipboard
 */
export declare const copy2clipboard: (str: string) => void;
/**
 * Force download file
 *
 * @param data Data to be downloaded or blob
 * @param type Content type
 * @param name Filename
 */
export declare const download: (data: BlobPart, type: string, name: string) => void;
/**
 * Capacitor only
 * Standard & safe way how to detect & return capacitor plugin
 *
 * @param ident ID of plugin to load
 * @returns Instance of the Capacitor plugin
 */
export declare function getNativePlugin<T = unknown>(ident: string): T | null;
/**
 * JQuery like selector
 *
 * @param sel selector
 * @param ctx Optional context where to find an selector
 * @returns Element by selector, null if not found
 */
export declare const $: <T extends HTMLElement = HTMLElement>(sel: string, ctx?: HTMLElement) => T;
/**
 * Basic function check
 */
export declare const isFunction: (p: unknown) => p is (...pr: unknown[]) => unknown;
/**
 * Is event touch event
 */
export declare const isTouchEvent: (ev: TouchEvent | MouseEvent) => ev is TouchEvent;
/**
 * Spline curve
 */
export declare const spline: (p0: number, p1: number, p2: number, p3: number, t: number) => number;
/**
 * Cubic hermite
 * ABCD ..control points, t ..coord <0,1>
 */
export declare const cubicHermite: (A: number, B: number, C: number, D: number, t: number) => number;
/**
 * m ..array of 16 samples; s, t ..relative coords <0,1>
 */
export declare const bicubicFiltering: (m: number[] | Float32Array, s: number, t: number) => number;
/**
 * clamp integer n value to interval <0, x)
 */
export declare const clamp0X: (n: number, x: number) => number;
/**
 * fast lerp
 */
export declare const lerp: (a: number, b: number, f: number) => number;
/**
 * fast lerp 256
 */
export declare const lerpColor256: (a: RGBA, b: RGBA, f: number) => RGBA;
/**
 * Finds all [data-ref] references in DOM and returns standard
 * refs object
 */
export declare const getRefs: <N extends HTMLElement, R extends Record<string, HTMLElement | SVGElement>>(
  selectorOrNode: string | N,
) => {
  node: N;
  refs: R;
};
/**
 * Sanitizes HTML code, escape all XSS dangerous characters
 */
export declare const sanitizeHTML: (s: string) => string;
export interface LogErrorDetail {
  moduleName: string;
  msg: string;
  errorObject?: Error | HttpError | Event | ErrorEvent | RegistrationError;
  additionalInfo?: {
    /**
     * Any additional data you want to log alongside the error to provide more context
     */
    extra?: Record<string, unknown>;
    /**
     * Key-value pairs to use as tags in GlitchTip
     */
    tags?: Record<string, string>;
  };
}
/**
 * Custom error logging function.
 *
 * In order to avoid circ deps we use custom Event to notify about errors
 * errorLogger module.
 *
 * @param moduleName Module name where error occured
 * @param msg Message to report, the main body of the error
 * @param errObj Whole error object to stringification. It is sent to Kibana under 'error' property
 */
export declare function logError(
  moduleName: string,
  msg: string,
  errorObject?: Error | HttpError | Event | ErrorEvent | RegistrationError,
  additionalInfo?: LogErrorDetail['additionalInfo'],
): void;
/**
 * Same as scale linear from d3 library except with different params
 * https://d3js.org/d3-scale/linear
 * @param Object { domain: [  ], range: [] }
 * @returns Object { get, invert }
 */
export declare const scaleLinear: ({
  domain,
  range,
  clip,
}: {
  domain: [number, number];
  range: [number, number];
  clip?: boolean;
}) => LinearScale;
export declare const maxCanvasRatio = 2;
/**
 * Unified canvasRatio used in overall Windy. Not bigger than maxCanvasRatio
 */
export declare const canvasRatio: number;
/**
 *  Returns items shared between all provided arrays
 */
export declare const intersect: <T>(arrays: T[][]) => T[];
/**
 * Is the weather station professional?
 */
export declare const isProfessionalStation: (type: ExtendedStationType) => boolean;
/**
 * wraps x-coord to appropriate range
 */
export declare const wrapCoords: (tilePoint: TilePoint) => TilePoint;
/**
 * Is valid NumValue
 */
export declare const isValidNumber: (d: NumOrNull | undefined) => boolean;
/**
 * Converts °C to K
 */
export declare const c2kelvin: (c: number) => number;
/**
 * Converts K to °C
 */
export declare const kelvin2c: (k: number) => number;
/**
 * Async version of wait
 */
export declare const wait: (t: Timestamp) => Promise<void>;
/**
 * Removes accents and diacritics from string
 * "Crème Brûlée" -> "Creme Brulee"
 * https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
 * TODO: Use Unicode property escapes when widely supported, currently at 94% at caniuse
 */
export declare const removeDiacritics: (s: string) => string;
/**
 * Capitalizes the first letter of a string.
 * This differs from the CSS property which capitalizes the first letter of each word.
 */
export declare const capitalize: (text: string) => string;
/**
 * Get unified path format out of ts
 */
export declare const getPathFromTs: (ts: Timestamp | Date, replacerPattern?: string) => Path;
export declare const parseQueryString: (searchQuery: string | undefined) => ParsedQueryString | undefined;
export declare const seoLangRegex: RegExp;
/**
 * Examples of SEO URLs:
 *
 * ## https://www.windy.com/cs/... (case [1])
 * SEO language, used in @module trans  Must be followed by string
 *
 * ## https://www.windy.com/-Name-Whatever-overlay (case [2])
 * SEO Name of Overlay
 *
 * ## https://www.windy.com/-Name-Whatever/... (case [3])
 * SEO NAME of plugin name, followed by any other string
 *
 * Remember that numbers are not allowed at the beginning of the URL, to distinguish
 * any URL from detail.
 *
 */
export declare const parseSeoUrl: (url: string) => {
  purl: string;
  overlay: string;
};
/**
 * Safely URL decoded startup pathname
 */
export declare const startupPath: any;
export declare const generateUuidV4: () => string;
export declare const getErrorMessage: (error: unknown) => string;
/**
 * Creates a color gradient from array of prepared ones
 */
export declare const createColorGradient: (
  gradient: (RGBAString | RGBString)[],
  numValues: NumValue[],
) => ColorGradientString;
/**
 * preventDefault wrapper for event handlers
 */
export declare const preventDefault: <E extends Event = Event>(callback: (event: E) => void) => (event: E) => void;
export declare const openInApp: () => void;
/**
 * Given the UTC offset returns local time
 */
export declare const toLocalTime: (
  ts: Timestamp,
  utcOffset: Hours,
) => {
  h: Hours;
  m: number;
  day: number;
  weekDay: number;
  yearMonthDay: YearMonthDay;
};
/**
 * @summary Extracts positions of the tile coordinates in the per-tile request urls to enabled coordinates extraction
 *  which is required to modify the original tile request created by maplibre
 * @param url
 * @returns
 */
export declare function extractTileCoordsUrlPositionsFromParametricUrl(url: string): Vector3;
/**
 * @summary Modifies the input leaflet zoom based on the currently used map library
 *  - maplibre zoom is offset by 1 from the leaflet zoom, since Leaflet uses
 *  zoom computed wrt 256px tile while maplibre uses 512px tile as base size
 * @param leafletZoom Leaflet-based zoom level
 */
export declare const offsetLeafletZoom: (leafletZoom: number) => number;
/**
 * Used for Svelte stores
 * Sometimes we only want to subscribe to changes in store and don't want to be called with initial value
 */
export declare const subscribeToChange: <T>(store: Readable<T>, callback: Subscriber<T>) => Unsubscriber;
/**
 * Computes dew point from relative humidity and temperature using the Magnus formula. Input and output temperatures are in degrees Celsius.
 * @param relativeHumidityPercent - Relative humidity, in percent (0..100).
 * @param temperatureCelsius - Temperature, in °C.
 * @returns Dew point, in °C.
 */
export declare const computeDewPointCelsius: (relativeHumidityPercent: number, temperatureCelsius: number) => number;
/**
 * Computes dew point from relative humidity and temperature using the Magnus formula. Input and output temperatures are in Kelvin.
 * @param relativeHumidityPercent - Relative humidity, in percent (0..100).
 * @param temperatureKelvin - Temperature, in degrees Kelvin.
 * @returns Dew point, in degrees Kelvin.
 */
export declare const computeDewPointKelvin: (relativeHumidityPercent: number, temperatureKelvin: number) => number;
/** Escapes special regex characters in a string so it can be used as a literal pattern */
export declare const escapeRegExp: (str: string) => string;
/**
 * Stop loading HTML videos when closing article
 */
export declare const unloadVideo: (video: HTMLVideoElement) => void;
