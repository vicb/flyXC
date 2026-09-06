import * as zlib from 'node:zlib';

import { Keys, LiveDataRetentionSec } from '@flyxc/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  clearProtoCache,
  decompressProto,
  getCachedProto,
  LIVE_TRACK_CACHE_TTL_MS,
  resolveLiveTrackKey,
  sendProtobufResponse,
} from './live-track';

describe('live-track routes and helpers', () => {
  const rawData = Buffer.from('hello-live-track-data');
  const gzippedData = zlib.gzipSync(rawData);

  describe('decompressProto', () => {
    it('should decompress gzipped buffers', () => {
      const result = decompressProto(gzippedData);
      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('hello-live-track-data');
    });

    it('should return null for null input', () => {
      expect(decompressProto(null)).toBeNull();
    });
  });

  describe('resolveLiveTrackKey', () => {
    const nowSec = 100000;

    it('should return ShortIncremental key when lastUpdate is very recent', () => {
      const lastUpdateSec = nowSec - (LiveDataRetentionSec.IncrementalShort - 10);
      expect(resolveLiveTrackKey(lastUpdateSec, 0, nowSec)).toBe(Keys.fetcherShortIncrementalProto);
    });

    it('should return LongIncremental key when lastUpdate is moderately recent', () => {
      const lastUpdateSec = nowSec - (LiveDataRetentionSec.IncrementalLong - 10);
      expect(resolveLiveTrackKey(lastUpdateSec, 0, nowSec)).toBe(Keys.fetcherLongIncrementalProto);
    });

    it('should return FullProtoH24 when fm is 24 * 60', () => {
      const lastUpdateSec = nowSec - (LiveDataRetentionSec.IncrementalLong + 100);
      expect(resolveLiveTrackKey(lastUpdateSec, 24 * 60, nowSec)).toBe(Keys.fetcherFullProtoH24);
    });

    it('should return FullProtoH48 when fm is 48 * 60', () => {
      const lastUpdateSec = nowSec - (LiveDataRetentionSec.IncrementalLong + 100);
      expect(resolveLiveTrackKey(lastUpdateSec, 48 * 60, nowSec)).toBe(Keys.fetcherFullProtoH48);
    });

    it('should default to FullProtoH12 for full requests', () => {
      const lastUpdateSec = nowSec - (LiveDataRetentionSec.IncrementalLong + 100);
      expect(resolveLiveTrackKey(lastUpdateSec, 0, nowSec)).toBe(Keys.fetcherFullProtoH12);
    });
  });

  describe('getCachedProto', () => {
    beforeEach(() => {
      clearProtoCache();
    });

    it('should fetch from Redis on cache miss and return cached value on subsequent calls within TTL', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(gzippedData),
      } as any;

      const baseTimeMs = 1_000_000;

      // 1. Initial call (cache miss)
      const res1 = await getCachedProto(mockRedis, 'test:key', LIVE_TRACK_CACHE_TTL_MS, baseTimeMs);
      expect(res1).toBe(gzippedData);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // 2. Second call within TTL (cache hit)
      const res2 = await getCachedProto(mockRedis, 'test:key', LIVE_TRACK_CACHE_TTL_MS, baseTimeMs + 10_000);
      expect(res2).toBe(gzippedData);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // 3. Third call after TTL expires (cache expired -> re-fetch)
      const res3 = await getCachedProto(mockRedis, 'test:key', LIVE_TRACK_CACHE_TTL_MS, baseTimeMs + 21_000);
      expect(res3).toBe(gzippedData);
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on clearProtoCache()', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(rawData),
      } as any;

      await getCachedProto(mockRedis, 'test:key');
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      clearProtoCache();

      await getCachedProto(mockRedis, 'test:key');
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent in-flight requests for the same key', async () => {
      let resolveRedis: (val: Buffer) => void;
      const delayedPromise = new Promise<Buffer>((resolve) => {
        resolveRedis = resolve;
      });

      const mockRedis = {
        get: vi.fn().mockReturnValue(delayedPromise),
      } as any;

      // Start multiple concurrent requests simultaneously
      const req1 = getCachedProto(mockRedis, 'concurrent:key');
      const req2 = getCachedProto(mockRedis, 'concurrent:key');
      const req3 = getCachedProto(mockRedis, 'concurrent:key');

      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      resolveRedis!(gzippedData);

      const [res1, res2, res3] = await Promise.all([req1, req2, req3]);
      expect(res1).toBe(gzippedData);
      expect(res2).toBe(gzippedData);
      expect(res3).toBe(gzippedData);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('should delete in-flight cache entry when Redis call fails and allow subsequent retries', async () => {
      const mockRedis = {
        get: vi.fn().mockRejectedValueOnce(new Error('Redis connection failed')).mockResolvedValueOnce(gzippedData),
      } as any;

      await expect(getCachedProto(mockRedis, 'error:key')).rejects.toThrow('Redis connection failed');
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // Subsequent call should retry and succeed
      const retryRes = await getCachedProto(mockRedis, 'error:key');
      expect(retryRes).toBe(gzippedData);
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendProtobufResponse', () => {
    function createMockRes() {
      const headers: Record<string, string> = {};
      const res: Partial<Response> = {
        set: vi.fn((key: string | Record<string, string>, value?: string) => {
          if (typeof key === 'string' && value) {
            headers[key] = value;
          }
          return res as Response;
        }),
        send: vi.fn(),
      };
      return { res: res as Response, headers };
    }

    it('should serve pre-gzipped buffer with Content-Encoding: gzip when client accepts gzip', () => {
      const req = {
        acceptsEncodings: vi.fn((encoding: string) => (encoding === 'gzip' ? 'gzip' : false)),
      } as unknown as Request;

      const { res, headers } = createMockRes();
      sendProtobufResponse(req, res, gzippedData);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/x-protobuf');
      expect(res.set).toHaveBeenCalledWith('Content-Encoding', 'gzip');
      expect(res.send).toHaveBeenCalledWith(gzippedData);
    });

    it('should decompress gzipped buffer on the fly when client does not accept gzip', () => {
      const req = {
        acceptsEncodings: vi.fn(() => false),
      } as unknown as Request;

      const { res, headers } = createMockRes();
      sendProtobufResponse(req, res, gzippedData);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/x-protobuf');
      expect(headers['Content-Encoding']).toBeUndefined();
      expect(res.send).toHaveBeenCalledWith(rawData);
    });

    it('should handle null buffer gracefully', () => {
      const req = {
        acceptsEncodings: vi.fn(() => false),
      } as unknown as Request;

      const { res } = createMockRes();
      sendProtobufResponse(req, res, null);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/x-protobuf');
      expect(res.send).toHaveBeenCalledWith(Buffer.alloc(0));
    });
  });
});
