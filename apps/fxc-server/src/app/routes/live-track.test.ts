/* eslint-disable @typescript-eslint/no-empty-function */
import * as zlib from 'node:zlib';

import { Keys, LiveTrackDurationSec, protos } from '@flyxc/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  clearProtoCache,
  decompressProto,
  getCachedProto,
  getTrackerRouter,
  handlePartnerTokenRequest,
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
    it('should return ShortIncremental key when sec is M5', () => {
      expect(resolveLiveTrackKey(LiveTrackDurationSec.M5)).toBe(Keys.fetcherIncrementalProtoM5);
    });

    it('should return LongIncremental key when sec is M20', () => {
      expect(resolveLiveTrackKey(LiveTrackDurationSec.M20)).toBe(Keys.fetcherIncrementalProtoM20);
    });

    it('should return FullProtoH24 when sec is H24', () => {
      expect(resolveLiveTrackKey(LiveTrackDurationSec.H24)).toBe(Keys.fetcherFullProtoH24);
    });

    it('should return FullProtoH48 when sec is H48', () => {
      expect(resolveLiveTrackKey(LiveTrackDurationSec.H48)).toBe(Keys.fetcherFullProtoH48);
    });

    it('should default to FullProtoH12 for H12 or other values', () => {
      expect(resolveLiveTrackKey(LiveTrackDurationSec.H12)).toBe(Keys.fetcherFullProtoH12);
      expect(resolveLiveTrackKey(0)).toBe(Keys.fetcherFullProtoH12);
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
      const res3 = await getCachedProto(
        mockRedis,
        'test:key',
        LIVE_TRACK_CACHE_TTL_MS,
        baseTimeMs + LIVE_TRACK_CACHE_TTL_MS + 1000,
      );
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

      const { res } = createMockRes();
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

  describe('handlePartnerTokenRequest', () => {
    beforeEach(() => {
      clearProtoCache();
    });

    it('should return 400 for an unknown partner token', async () => {
      const req = {} as Request;
      const res = {
        sendStatus: vi.fn(),
      } as unknown as Response;
      const bufferRedis = {} as any;

      await handlePartnerTokenRequest(req, res, 'invalid-token', bufferRedis);
      expect(res.sendStatus).toHaveBeenCalledWith(400);
    });

    it('should fetch Keys.fetcherPartnersProtoM30 and return anonymized tracks for valid partner tokens', async () => {
      const sampleGroup = protos.LiveDifferentialTrackGroup.create({
        tracks: [
          {
            id: 123,
            name: 'John Doe',
            flags: [1],
            extra: { 0: { speed: 20 } },
            lat: [100],
            lon: [200],
            alt: [300],
            gndAlt: [400],
            timeSec: [1000],
          },
        ],
      });
      const gzippedProto = zlib.gzipSync(Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(sampleGroup)));

      const mockRedis = {
        get: vi.fn().mockResolvedValue(gzippedProto),
      } as any;

      const req = {
        header: vi.fn().mockReturnValue(undefined), // not json
      } as unknown as Request;

      let sentBody: any = null;
      const res = {
        set: vi.fn().mockReturnThis(),
        send: vi.fn((body) => {
          sentBody = body;
          return res;
        }),
      } as unknown as Response;

      await handlePartnerTokenRequest(req, res, SECRETS.WING_TOKEN, mockRedis);

      expect(mockRedis.get).toHaveBeenCalledWith(Keys.fetcherPartnersProtoM30);
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/x-protobuf');

      const parsedAnonGroup = protos.LiveDifferentialTrackGroup.fromBinary(sentBody);
      expect(parsedAnonGroup.tracks).toHaveLength(1);
      const track = parsedAnonGroup.tracks[0];
      expect(track.id).toBeUndefined();
      expect(typeof track.idStr).toBe('string');
      expect(track.idStr).not.toBe('123');
      expect(track.name).toBe('');
      expect(track.flags).toEqual([]);
      expect(track.extra).toEqual({});
      expect(track.lat).toEqual([100]);
    });

    it('should return JSON when accept header is application/json', async () => {
      const sampleGroup = protos.LiveDifferentialTrackGroup.create({
        tracks: [
          {
            id: 456,
            name: 'Jane Doe',
            flags: [2],
            extra: {},
            lat: [50],
            lon: [60],
            alt: [700],
            gndAlt: [800],
            timeSec: [2000],
          },
        ],
      });
      const gzippedProto = zlib.gzipSync(Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(sampleGroup)));

      const mockRedis = {
        get: vi.fn().mockResolvedValue(gzippedProto),
      } as any;

      const req = {
        header: vi.fn((name: string) => (name === 'accept' ? 'application/json' : undefined)),
      } as unknown as Request;

      let jsonBody: any = null;
      const res = {
        json: vi.fn((body) => {
          jsonBody = body;
          return res;
        }),
      } as unknown as Response;

      await handlePartnerTokenRequest(req, res, SECRETS.FLYME_TOKEN, mockRedis);

      expect(mockRedis.get).toHaveBeenCalledWith(Keys.fetcherPartnersProtoM30);
      expect(res.json).toHaveBeenCalled();
      expect(jsonBody.tracks).toHaveLength(1);
      expect(jsonBody.tracks[0].name).toBeFalsy();
      expect(jsonBody.tracks[0].idStr).toBeDefined();
    });
  });

  describe('/tracks.pbf route', () => {
    beforeEach(() => {
      clearProtoCache();
    });

    it('should set public Cache-Control header and resolve key based on sec query param', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(gzippedData),
        withTypeMapping: vi.fn().mockReturnThis(),
      } as any;
      const router = getTrackerRouter(mockRedis, {} as any);
      const headers: Record<string, string> = {};
      const req = {
        method: 'GET',
        url: `/tracks.pbf?sec=${LiveTrackDurationSec.M5}`,
        query: { sec: String(LiveTrackDurationSec.M5) },
        header: vi.fn().mockReturnValue(undefined),
        acceptsEncodings: vi.fn().mockReturnValue('gzip'),
      } as any;
      let sentData: any = null;
      const res = {
        set: vi.fn((k: string, v: string) => {
          headers[k] = v;
          return res;
        }),
        vary: vi.fn((field: string) => {
          headers['Vary'] = field;
          return res;
        }),
        send: vi.fn((data) => {
          sentData = data;
          return res;
        }),
      } as any;

      router(req, res, () => {});
      await vi.waitFor(() => expect(res.send).toHaveBeenCalled());

      expect(headers['Cache-Control']).toBe(`public, max-age=30`);
      expect(headers['Vary']).toBe('Accept-Encoding');
      expect(mockRedis.get).toHaveBeenCalledWith(Keys.fetcherIncrementalProtoM5);
      expect(sentData).toBe(gzippedData);
    });

    it('should set no-store Cache-Control header for partner token requests', async () => {
      const emptyGroupGzip = zlib.gzipSync(
        Buffer.from(protos.LiveDifferentialTrackGroup.toBinary(protos.LiveDifferentialTrackGroup.create())),
      );
      const mockRedis = {
        get: vi.fn().mockResolvedValue(emptyGroupGzip),
        withTypeMapping: vi.fn().mockReturnThis(),
      } as any;
      const router = getTrackerRouter(mockRedis, {} as any);
      const headers: Record<string, string> = {};
      const req = {
        method: 'GET',
        url: '/tracks.pbf',
        header: vi.fn((name: string) => (name === 'token' ? SECRETS.WING_TOKEN : undefined)),
        acceptsEncodings: vi.fn().mockReturnValue('gzip'),
      } as any;
      const res = {
        set: vi.fn((k: string, v: string) => {
          headers[k] = v;
          return res;
        }),
        send: vi.fn().mockReturnThis(),
      } as any;

      router(req, res, () => {});
      await vi.waitFor(() => expect(res.send).toHaveBeenCalled());

      expect(headers['Cache-Control']).toBe('no-store');
    });
  });
});
