import { Timestamp } from '@windy/types.d';

export type QueryStringSource = Record<string | number, string | number | undefined | null | boolean>;

/**
 * Options for http requests
 */
export interface HttpOptions {
  /**
   * Signal from `AbortController` used to abort the request.
   */
  abortSignal?: AbortSignal;

  /**
   * Query string as object of 🔐 value pairs
   */
  qs?: QueryStringSource;

  /**
   * By default all responses are considered JSON and parsed
   * Use binary option to fetch data via arrayBuffer and use it as binary data
   */
  binary?: boolean;

  /**
   * Should we use out internal LRU cache (default true)
   */
  cache?: boolean;

  /**
   * Always treat http response as JSON
   */
  json?: boolean;

  /**
   * Any object to be sent via POST method
   */
  data?: unknown;

  /**
   * Add login credentials/cookies or preflight request
   */
  withCredentials?: boolean;

  /**
   * TTL of cache object (in ms)
   */
  ttl?: Timestamp;

  /**
   * Request timeout (in ms)
   */
  timeout?: Timestamp;

  /**
   * Custom headers object
   */
  customHeaders?: Record<string, string>;
}

/**
 * Standard result payload
 */
export interface HttpPayload<T> {
  /**
   * Status code
   */
  status: number;

  /**
   * Is the response JSON? Internal flag for caching purpose, do not use
   */
  isJSON?: boolean;

  /**
   * Expiration time. Internal value for caching purpose.
   */
  expire?: Timestamp;

  /**
   * Payload.
   */
  data: T;
}
