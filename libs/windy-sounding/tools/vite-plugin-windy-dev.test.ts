import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { WINDY_ORIGINS, windyDevPlugin } from './vite-plugin-windy-dev.ts';

describe('windyDevPlugin CORS handling', () => {
  it('defines the allowed origins for Windy', () => {
    expect(WINDY_ORIGINS).toEqual(['https://windy.com', 'https://www.windy.com']);
  });

  function setupMiddleware() {
    const plugin = windyDevPlugin();
    let middleware: ((req: any, res: any, next: any) => Promise<void>) | undefined;
    const serverMock = {
      middlewares: {
        use: (fn: any) => {
          middleware = fn;
        },
      },
    };
    (plugin as any).configureServer(serverMock);
    return middleware!;
  }

  it('allows requests from https://windy.com', async () => {
    const middleware = setupMiddleware();
    const headers: Record<string, string> = {};
    const req = {
      method: 'GET',
      url: '/other',
      headers: { origin: 'https://windy.com' },
    } as unknown as IncomingMessage;
    const res = {
      setHeader: vi.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://windy.com');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', '*');
    expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin');
    expect(next).toHaveBeenCalled();
  });

  it('allows requests from https://www.windy.com', async () => {
    const middleware = setupMiddleware();
    const req = {
      method: 'GET',
      url: '/other',
      headers: { origin: 'https://www.windy.com' },
    } as unknown as IncomingMessage;
    const res = {
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://www.windy.com');
    expect(next).toHaveBeenCalled();
  });

  it('handles OPTIONS preflight from allowed origin with 204', async () => {
    const middleware = setupMiddleware();
    const req = {
      method: 'OPTIONS',
      headers: { origin: 'https://windy.com' },
    } as unknown as IncomingMessage;
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://windy.com');
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects OPTIONS preflight from untrusted origin with 403', async () => {
    const middleware = setupMiddleware();
    const req = {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.com' },
    } as unknown as IncomingMessage;
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not set CORS headers for untrusted origins on standard requests', async () => {
    const middleware = setupMiddleware();
    const req = {
      method: 'GET',
      url: '/other',
      headers: { origin: 'https://evil.com' },
    } as unknown as IncomingMessage;
    const res = {
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    expect(next).toHaveBeenCalled();
  });
});
