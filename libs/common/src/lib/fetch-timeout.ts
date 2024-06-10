const retryOnErrorCode = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'EADDRINUSE',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

const retryOnStatus = new Set([408, 413, 500, 502, 503, 504, 521, 522, 524]);

/**
 * Fetches an URL
 *
 * Returns a response or trow on error.
 * The returned response might have response.ok != true.
 */
export async function fetchResponse(
  url: string,
  options?: {
    retry?: number;
    timeoutS?: number;
    retryOnTimeout?: boolean;
    log?: boolean;
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    credentials?: RequestCredentials;
  },
): Promise<Response> {
  const {
    retry = 3,
    timeoutS = 5,
    retryOnTimeout = false,
    log = false,
    method = undefined,
    headers = undefined,
    body = undefined,
    credentials = undefined,
  } = options ?? {};
  let signal = (AbortSignal as any).timeout(timeoutS * 1000);
  let error = new Error(`Retried ${retry} times`);

  const start = Date.now() / 1000;

  log && console.log(`Start fetch, timeout = ${timeoutS}`);

  for (let numRetry = 0; numRetry < retry; numRetry++) {
    try {
      const response = await fetch(url, { signal, method, headers, body, credentials });
      log && console.log(`got response ${(Date.now() / 1000 - start).toFixed(1)}s`);
      if (response.ok) {
        log && console.log(`return response ${(Date.now() / 1000 - start).toFixed(1)}s`);
        return response;
      }
      if (retryOnStatus.has(response.status)) {
        log && console.log(`retry on status ${response.status} ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = Error(`Status = ${response.status}`);
        continue;
      }
      if (response.status == 429) {
        log && console.log(`status = 429`, response.headers);
      }
      return response;
    } catch (e: any) {
      if (e?.name == 'AbortError' || e?.name == 'TimeoutError') {
        log && console.log(`timeout ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = Error(`Timeout ${timeoutS}s`);
        if (retryOnTimeout) {
          signal = (AbortSignal as any).timeout(timeoutS * 1000);
          continue;
        }
        throw error;
      }
      if (retryOnErrorCode.has(e?.code)) {
        log && console.log(`retry on error code ${e?.code} ${(Date.now() / 1000 - start).toFixed(1)}s`);
        error = e as Error;
        continue;
      }
      throw e;
    }
  }

  log && console.log(`throw ${Date.now() / 1000 - start}s`);
  throw error;
}
