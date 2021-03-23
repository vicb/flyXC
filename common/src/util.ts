// Formats request-zero errors.
export function formatReqError(error: any): string {
  if (error === undefined) {
    return 'undefined';
  }
  if (error != null) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object') {
      switch (error.code) {
        case 'ECONNRESET':
        case 'ETIMEDOUT':
        case 'CERT_HAS_EXPIRED':
        case 401: // Unauthorized
        case 503: // Unavailable
        case 502: // Bad Gateway
          return `${error.code} (${error.message ?? ''})`;
        case 'ECONNREFUSED':
        case 404:
          return String(error.code);
        case 500:
          return `500 (Internal server error)`;
      }
    }
  }

  return JSON.stringify(error).replace(/\"/gi, '');
}

// Executes `slots` callbacks in parallel with a timeout.
//
// Based on https://github.com/rxaviers/async-pool.
export async function parallelTasksWithTimeout<T>(
  slots: number,
  items: T[],
  callback: (item: T, index: number) => unknown,
  timeoutMs = 0,
): Promise<{ results: PromiseSettledResult<unknown>[]; isTimeout: boolean }> {
  const started: Promise<unknown>[] = [];
  const executing: Promise<unknown>[] = [];

  let isTimeout = false;
  const timeoutId: any = timeoutMs > 0 ? setInterval(() => (isTimeout = true), timeoutMs) : 0;
  let index = 0;

  for (const item of items) {
    const p = Promise.resolve().then(() => callback(item, index));
    started.push(p);
    index++;

    if (items.length >= slots) {
      // Track executing tasks.
      const e: Promise<unknown> = p.finally(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      // Wait on a task when all slots are busy.
      if (executing.length >= slots) {
        try {
          await Promise.race(executing);
        } catch {}
      }
    }

    if (isTimeout) {
      break;
    }
  }

  const results = await Promise.allSettled(started);
  clearInterval(timeoutId);
  return { results, isTimeout };
}
