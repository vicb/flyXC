import lodepng from '@cwasm/lodepng';
import { BYTES_PER_TILE, TILE_SIZE_PX, type TileDecoder } from '@flyxc/common';

/**
 * Tile decoder for Node.js using @cwasm/lodepng.
 * Decodes a PNG ArrayBuffer into a 256x256 RGBA Uint8ClampedArray.
 *
 * @param buffer - Raw PNG file buffer.
 * @returns Decoded RGBA pixel buffer (256x256x4 bytes) or null if decoding fails.
 */
export const nodeTileDecoder: TileDecoder = (buffer: ArrayBufferLike): Uint8ClampedArray | null => {
  try {
    const img = lodepng.decode(Buffer.from(buffer as ArrayBuffer));
    if (img.width === TILE_SIZE_PX && img.height === TILE_SIZE_PX && img.data.length === BYTES_PER_TILE) {
      return img.data;
    }
  } catch {
    // Decoding failed.
  }
  return null;
};
