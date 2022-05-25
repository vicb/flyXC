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

const retryOnStatus = new Set([408, 413, 429, 500, 502, 503, 504, 521, 522, 524]);

/**
 * Fetches an URL
 *
 * Returns a response or trow on error.
 * The returned response might have response.ok != true.
 */
export async function fetchResponse(
  url: string,
  options?: { retry?: number; timeoutS?: number; retryOnTimeout?: boolean },
): Promise<Response> {
  const { retry = 3, timeoutS = 5, retryOnTimeout = false } = options ?? {};
  let signal = (AbortSignal as any).timeout(timeoutS * 1000);
  let error = new Error(`Retried ${retry} times`);

  for (let numRetry = 0; numRetry < retry; numRetry++) {
    try {
      const response = await fetch(url, { signal });
      if (response.ok) {
        return response;
      }
      if (retryOnStatus.has(response.status)) {
        continue;
      }
      return response;
    } catch (e: any) {
      if (e?.name == 'AbortError' || e?.name == 'TimeoutError') {
        error = Error(`Timeout ${timeoutS}s`);
        if (retryOnTimeout) {
          signal = (AbortSignal as any).timeout(timeoutS * 1000);
          continue;
        }
        throw error;
      }
      if (retryOnErrorCode.has(e?.code)) {
        error = e as Error;
        continue;
      }
      throw e;
    }
  }

  throw error;
}
