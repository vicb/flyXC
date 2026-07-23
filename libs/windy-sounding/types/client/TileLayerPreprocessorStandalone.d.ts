import { type TileHeader } from '@windy/TileLayerUtils';
import { GlTexture } from '@windy/glUtils';
import type { Coords } from '@leafletGl';
import type { FullRenderParameters } from '@windy/interfaces';
/**
 * A refactored TileLayer preprocessor intended for use with the new tile management.
 * Assumes that it is only created once for a given set of render params and then disposed when render params change.
 * Render params may not be changed after initialization.
 */
export declare class TileLayerPreprocessorStandalone {
  private _renderer;
  private _primaryGradient?;
  private _renderProperties;
  private _ptypeColors;
  private _params;
  private _gl;
  private _destroyed;
  private _fbo;
  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, params: FullRenderParameters);
  /**
   * Processes a tile with the preprocessing shader, storing the result in the specified destination texture.
   * Returns an object containing parameters used to render this tile.
   * These parameters are then useful when rendering patterns in the final pass.
   *
   * @param coords - Coordinates of the rendered tile.
   * @param dataTex - Input data texture.
   * @param dataHeader - Input data header (needed for decoding of data texture).
   * @param destinationTex - Texture into which the result is stored. This texture will be temporarily bound to a framebuffer.
   * @returns Uniform parameters used to render this tile.
   */
  preRenderToTexture(
    coords: Coords,
    dataTex: WebGLTexture,
    dataHeader: TileHeader,
    destinationTex: GlTexture,
  ): {
    dataTileScaleOffset: number[];
    sizeS: number;
    srcPixelSize: number;
  };
  destroy(): void;
  /**
   * Renders a tile with the preprocessing shader into the currently bound framebuffer.
   * Returns some uniforms used to render this tile.
   */
  private _renderTile;
  private _bindUniforms;
  /**
   * @summary Initializes the preprocessor renderer including its shader program and geometry
   */
  private _initRenderer;
  /**
   * @summary Function called on each params update (in case user changed color palette)
   */
  private _createUpdateGradients;
}
