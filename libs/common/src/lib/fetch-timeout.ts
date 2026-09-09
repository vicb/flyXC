/**
 * Network error codes that trigger an automatic retry.
 */
const retryOnErrorCode = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'EADDRINUSE',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
]);

/**
 * HTTP response status codes that trigger an automatic retry.
 *
 * Includes standard server errors (500, 502, 503, 504), request timeout (408),
 * payload too large (413), and Cloudflare edge errors (521, 522, 524).
 */
const retryOnStatus = new Set([408, 413, 500, 502, 503, 504, 521, 522, 524]);

/**
 * Configuration options for {@link fetchResponse}.
 */
export interface FetchResponseOptions {
  /**
   * Maximum number of fetch attempts before throwing an error.
   * @default 3
   */
  retry?: number;

  /**
   * Request timeout in seconds per attempt.
   * @default 5
   */
  timeoutS?: number;

  /**
   * Whether to retry the request if an attempt times out.
   * When `false`, a timeout immediately throws without further retries.
   * @default false
   */
  retryOnTimeout?: boolean;

  /**
   * Whether to log fetch attempts, timing, and retry reasons to the console.
   * @default false
   */
  log?: boolean;

  /**
   * HTTP request method (e.g. 'GET', 'POST').
   */
  method?: string;

  /**
   * Request headers.
   */
  headers?: HeadersInit;

  /**
   * Request body.
   */
  body?: BodyInit;

  /**
   * Request credentials mode (e.g. 'omit', 'same-origin', 'include').
   */
  credentials?: RequestCredentials;

  /**
   * Optional custom dispatcher (e.g. Undici ProxyAgent or Agent).
   *
   * Note: This is specific to Node.js / Undici and has no effect in browser environments,
   * where `window.fetch` does not support custom dispatchers.
   */
  dispatcher?: any;

  /**
   * Optional external AbortSignal to cancel the request.
   * If aborted by the caller, the error is rethrown immediately without retrying.
   */
  signal?: AbortSignal;

  /**
   * Optional custom `fetch` implementation (e.g. `undici.fetch` in Node.js).
   *
   * ### Why use this:
   * When using custom Undici dispatchers (like `ProxyAgent`), pairing `undici.fetch`
   * with `undici.ProxyAgent` ensures both share the exact same internal dispatcher
   * protocol from the installed npm package. This completely decouples requests
   * from the Node.js runtime's embedded Undici version, preventing runtime crashes
   * (e.g. "invalid onRequestStart method") across different environments (local vs.
   * Docker vs. production VM).
   *
   * Defaults to `globalThis.fetch`.
   */
  fetch?: (input: any, init?: any) => Promise<Response>;
}

/**
 * Fetches a URL with automated retries and timeout handling.
 *
 * ### Retry Behavior
 * Retries are performed up to `retry` times (default 3) when:
 * - The server returns a transient HTTP status in {@link retryOnStatus} (e.g. 500, 502, 503, 504, 521, 522, 524, 408, 413).
 * - A network-level error occurs with a code in {@link retryOnErrorCode} (e.g. ECONNRESET, ECONNREFUSED, ENOTFOUND).
 *   Note: In Node.js / Undici, network error codes are extracted from both `error.code` and `error.cause.code`.
 * - The request times out, but **only** if `retryOnTimeout` is explicitly set to `true`.
 *
 * ### Timeout
 * Each attempt is given a fresh timeout of `timeoutS` seconds (default 5s).
 *
 * ### Response
 * Returns the `Response` object on success or if the HTTP status is not retryable
 * (e.g., 404 Not Found, or 429 Too Many Requests). Note that `response.ok` is not guaranteed
 * to be `true`, so callers should check `response.ok` or `response.status` as needed.
 *
 * @param url - The URL to fetch.
 * @param options - Configuration options for the fetch operation.
 * @returns Resolves with the `Response` object.
 * @throws `Error` when retries are exhausted, timeout expires (without retryOnTimeout),
 *         or an unhandled/fatal error occurs.
 */
export async function fetchResponse(url: string, options?: FetchResponseOptions): Promise<Response> {
  const {
    retry = 3,
    timeoutS = 5,
    retryOnTimeout = false,
    log = false,
    method = undefined,
    headers = undefined,
    body = undefined,
    credentials = undefined,
    dispatcher = undefined,
    signal: externalSignal = undefined,
    fetch: fetchOverride = undefined,
  } = options ?? {};

  let error = new Error(`Retried ${retry} times`);
  const start = Date.now() / 1000;

  /* eslint-disable @typescript-eslint/no-unused-expressions */
  log && console.log(`Start fetch, timeout = ${timeoutS}s`);

  const fetchFn = fetchOverride ?? globalThis.fetch;

  for (let numRetry = 0; numRetry < retry; numRetry++) {
    const timeoutSignal = AbortSignal.timeout(timeoutS * 1000);
    // AbortSignal.any is supported in
    // - Node 20.0+ (Apr 2023)
    // - Chrome 116+ (Aug 2023)
    // - Firefox 115+ (Jul 2023)
    // - Safari 17.4+ (Mar 2024).
    const attemptSignal = externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;

    try {
      const response = await fetchFn(url, {
        signal: attemptSignal,
        method,
        headers,
        body,
        credentials,
        ...(dispatcher ? { dispatcher } : {}),
      } as any);

      log && console.log(`got response ${(Date.now() / 1000 - start).toFixed(1)}s`);

      if (response.ok) {
        log && console.log(`return response ${(Date.now() / 1000 - start).toFixed(1)}s`);
        return response;
      }

      if (retryOnStatus.has(response.status)) {
        log && console.log(`retry on status ${response.status} ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = new Error(`Status = ${response.status}`);
        continue;
      }

      if (response.status === 429) {
        log && console.log(`status = 429`, response.headers);
      }

      return response;
    } catch (e: any) {
      if (externalSignal?.aborted) {
        throw e;
      }

      if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
        log && console.log(`timeout ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = new Error(`Timeout ${timeoutS}s`);
        if (retryOnTimeout) {
          continue;
        }
        throw error;
      }

      const errorCode = e?.code ?? e?.cause?.code;
      if (errorCode && retryOnErrorCode.has(errorCode)) {
        log && console.log(`retry on error code ${errorCode} ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = e as Error;
        continue;
      }

      throw e;
    }
  }

  log && console.log(`throw ${Date.now() / 1000 - start}s`);
  throw error;
}
