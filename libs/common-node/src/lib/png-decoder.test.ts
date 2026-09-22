import lodepng from '@cwasm/lodepng';
import { BYTES_PER_TILE, ElevationService, TILE_SIZE_PX } from '@flyxc/common';
import { describe, expect, it, vi } from 'vitest';

import { nodeTileDecoder } from './png-decoder';

describe('nodeTileDecoder in common-node', () => {
  it('decodes a valid 256x256 PNG buffer into RGBA Uint8ClampedArray', async () => {
    const raw = new Uint8ClampedArray(BYTES_PER_TILE);
    // Fill first pixel
    raw[0] = 131;
    raw[1] = 232;
    raw[2] = 0;
    raw[3] = 255;

    const encoded = lodepng.encode({ width: TILE_SIZE_PX, height: TILE_SIZE_PX, data: raw });
    const arrayBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
    const decoded = await nodeTileDecoder(arrayBuffer);

    expect(decoded).not.toBeNull();
    expect(decoded?.length).toBe(BYTES_PER_TILE);
    expect(decoded?.[0]).toBe(131);
    expect(decoded?.[1]).toBe(232);
    expect(decoded?.[2]).toBe(0);
    expect(decoded?.[3]).toBe(255);
  });

  it('returns null when given an invalid / corrupted buffer', () => {
    const corrupted = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(nodeTileDecoder(corrupted.buffer)).toBeNull();
  });

  it('returns null when image dimensions are not 256x256', () => {
    const raw = new Uint8ClampedArray(10 * 10 * 4);
    const encoded = lodepng.encode({ width: 10, height: 10, data: raw });
    expect(nodeTileDecoder(encoded.buffer)).toBeNull();
  });

  it('integrates successfully with ElevationService', async () => {
    const service = new ElevationService({ cacheCapacity: 10, zoom: 10, decoder: nodeTileDecoder });

    const raw = new Uint8ClampedArray(BYTES_PER_TILE);
    // 1000m: 1000 + 32768 = 33768. R: 131, G: 232, B: 0
    for (let i = 0; i < 256 * 256; i++) {
      raw[i * 4] = 131;
      raw[i * 4 + 1] = 232;
      raw[i * 4 + 2] = 0;
      raw[i * 4 + 3] = 255;
    }
    const png = lodepng.encode({ width: TILE_SIZE_PX, height: TILE_SIZE_PX, data: raw });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(png as unknown as BodyInit, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );

    const result = await service.fetchCoordinatesAltitude([45.83], [6.86]);
    expect(result.hasErrors).toBe(false);
    expect(result.altitudes[0]).toBe(1000);

    fetchSpy.mockRestore();
  });
});
