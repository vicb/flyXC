import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchResponse } from './fetch-timeout';

describe('fetchResponse', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return response on 200 OK', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const res = await fetchResponse('https://example.com/test');
    expect(res).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should return response on non-retryable status like 404 or 429', async () => {
    const res404 = new Response('not found', { status: 404 });
    globalThis.fetch = vi.fn().mockResolvedValue(res404);

    const res = await fetchResponse('https://example.com/test');
    expect(res.status).toBe(404);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const res429 = new Response('rate limited', { status: 429 });
    globalThis.fetch = vi.fn().mockResolvedValue(res429);

    const res2 = await fetchResponse('https://example.com/test');
    expect(res2.status).toBe(429);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient status (500, 502, 503) and succeed if subsequent attempt succeeds', async () => {
    const res500 = new Response('error', { status: 500 });
    const res200 = new Response('ok', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(res500).mockResolvedValueOnce(res200);

    const res = await fetchResponse('https://example.com/test', { retry: 3 });
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw when retries are exhausted on status 503', async () => {
    const res503 = new Response('unavailable', { status: 503 });
    globalThis.fetch = vi.fn().mockResolvedValue(res503);

    await expect(fetchResponse('https://example.com/test', { retry: 3 })).rejects.toThrow('Status = 503');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('should retry on network error with cause.code (Node fetch style)', async () => {
    const netErr = new TypeError('fetch failed');
    (netErr as any).cause = { code: 'ECONNRESET' };
    const res200 = new Response('ok', { status: 200 });

    globalThis.fetch = vi.fn().mockRejectedValueOnce(netErr).mockResolvedValueOnce(res200);

    const res = await fetchResponse('https://example.com/test', { retry: 3 });
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on timeout when retryOnTimeout is false', async () => {
    const timeoutErr = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    globalThis.fetch = vi.fn().mockRejectedValue(timeoutErr);

    await expect(
      fetchResponse('https://example.com/test', { retry: 3, timeoutS: 2, retryOnTimeout: false }),
    ).rejects.toThrow('Timeout 2s');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on timeout when retryOnTimeout is true', async () => {
    const timeoutErr = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const res200 = new Response('ok', { status: 200 });

    globalThis.fetch = vi.fn().mockRejectedValueOnce(timeoutErr).mockResolvedValueOnce(res200);

    const res = await fetchResponse('https://example.com/test', { retry: 3, timeoutS: 2, retryOnTimeout: true });
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should abort immediately when external signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const abortErr = new DOMException('This operation was aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    await expect(fetchResponse('https://example.com/test', { signal: controller.signal, retry: 3 })).rejects.toThrow(
      abortErr,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
