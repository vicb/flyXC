import { GlTexture } from '@windy/glUtils';
import { type Color } from '@windy/Color';
import type { DataQuality } from '@windy/Product';
import type { Vector2 } from '@windy/math';
export type TileHeader = {
  decoderRstep: number;
  decoderRmin: number;
  decoderGstep: number;
  decoderGmin: number;
  decoderBstep: number;
  decoderBmin: number;
};
/**
 * TileLayer min-max zoom - affects all tileLayer-based layers (tileLayer, accumulations, etc)
 */
export declare const tileLayerZoomBounds: Vector2;
export type GradientProps = {
  texture: GlTexture | null;
  mul: number;
  add: number;
} | null;
export declare function decodeHeader(imageData: Uint8Array | Uint8ClampedArray, width: number): Float32Array;
export declare function processHeader(decodedHeader: Float32Array): TileHeader;
export declare function imageBitmapToUint8Array(imageBitmap: ImageBitmap): Uint8Array;
/**
 * Creates color gradient texture
 * @param colorObj Color instance
 * @returns texture with additional params
 */
export declare function createGradientObject(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  colorObj: Color,
): GradientProps;
export declare function prepareRainPattern(gl: WebGL2RenderingContext | WebGLRenderingContext): GlTexture;
/**
 * @summary Returns data zoom offset for the supplied data quality
 *  - zoom offset is used to offset the current map/tile zoom for fetching data tiles
 * @param dataQuality
 */
export declare function dataQualityToZoomOffset(dataQuality: DataQuality): number;
export declare const decodedTileDataSize = 257;
/**
 * Returns a 257x257 texture containing the image with the header removed.
 */
export declare function decodeImageBytesCompact(imageData: Uint8Array | Uint8ClampedArray): Uint8Array;
export declare function decodeImage(imageData: Uint8Array): Promise<ImageBitmap>;
