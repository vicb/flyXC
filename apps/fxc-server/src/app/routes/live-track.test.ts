import * as zlib from 'node:zlib';

import { Keys, LiveDataRetentionSec } from '@flyxc/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ensureDecompressed, isGzip, resolveLiveTrackKey, sendProtobufResponse } from './live-track';

describe('live-track routes and helpers', () => {
  const rawData = Buffer.from('hello-live-track-data');
  const gzippedData = zlib.gzipSync(rawData);

  describe('isGzip', () => {
    it('should detect valid gzip buffers with magic header (0x1f, 0x8b)', () => {
      expect(isGzip(gzippedData)).toBe(true);
    });

    it('should return false for uncompressed buffers', () => {
      expect(isGzip(rawData)).toBe(false);
    });

    it('should return false for short or null/undefined buffers', () => {
      expect(isGzip(null)).toBe(false);
      expect(isGzip(undefined)).toBe(false);
      expect(isGzip(Buffer.from([0x1f]))).toBe(false);
      expect(isGzip(Buffer.alloc(0))).toBe(false);
    });
  });

  describe('ensureDecompressed', () => {
    it('should decompress gzipped buffers', () => {
      const result = ensureDecompressed(gzippedData);
      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('hello-live-track-data');
    });

    it('should return uncompressed buffers unchanged', () => {
      const result = ensureDecompressed(rawData);
      expect(result).toBe(rawData);
    });

    it('should return null for null input', () => {
      expect(ensureDecompressed(null)).toBeNull();
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

    it('should serve uncompressed buffer as-is', () => {
      const req = {
        acceptsEncodings: vi.fn((encoding: string) => (encoding === 'gzip' ? 'gzip' : false)),
      } as unknown as Request;

      const { res, headers } = createMockRes();
      sendProtobufResponse(req, res, rawData);

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
