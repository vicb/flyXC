import type { GlTexture } from '@windy/glUtils';
import type { Coords } from '@leafletGl';
export declare enum TilePreprocessorType {
  NONE = 0,
  RADAR_FLOW = 1,
  RADAR_DATA_WEBP = 2,
  SATELLITE_DATA = 3,
  SATELLITE_FLOW = 4,
  TILE_LAYER = 5,
  RADAR_PTYPE = 6,
}
export declare class PreprocessedTileParams {
  tileCoords: Coords;
  payload?: unknown;
}
export declare abstract class TilePreprocessor {
  /**
   * @summary Renders given tile (texture) using the preprocessor into the the currently bound framebuffer
   * @param tileTexture Texture to preprocess
   * @param params Additional optional parameters which might be required for some preprocessing
   */
  abstract renderTile(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    tileTexture: GlTexture,
    tileParams: PreprocessedTileParams,
  ): void;
  /**
   * @summary Deletes the preprocessor (releases its resources)
   */
  abstract destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
}
