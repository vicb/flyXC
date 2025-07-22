/**
 * HTTP fetch lib using Promises, authorization and lru caching
 */
import type { HttpOptions, HttpPayload } from './d.ts.files/http.d';
/**
 * Type of the string, that will be added to the header in Accept line to increase stealing protection a little bit
 *
 * Target mobile: Use legacy header format until mobile apps start sending correct origin to pass CORS check on the server
 */
export declare const acceptHeader: string;
/**
 * Enhances URL with server, tokens and auth counter
 */
export declare const getURL: (url: string) => string;
/**
 * Create Event Source for SSE with tokens for authentication
 * Do not forget to close the EventSource, otherwise there will be an error event when the page closes.
 *
 * @param url Url
 * @param options Options
 * @returns Event source or null when anything failed
 */
export declare const createEventSource: (url: string, options?: EventSourceInit) => EventSource | null;
type StandardHttpRequestFun = <T>(url: string, options?: HttpOptions) => Promise<HttpPayload<T>>;
/**
 * Make GET http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const get: StandardHttpRequestFun;
/**
 * Make DELETE http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const del: StandardHttpRequestFun;
/**
 * Make POST http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const post: StandardHttpRequestFun;
/**
 * Make PUT http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const put: StandardHttpRequestFun;
/**
 * Make PATCH http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const patch: StandardHttpRequestFun;
/**
 * Make HEAD http request
 *
 * @param url Url
 * @param options Options
 * @returns HTTP payload or null when anything failed
 */
export declare const head: StandardHttpRequestFun;
export type { HttpOptions, HttpPayload };
