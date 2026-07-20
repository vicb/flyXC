import { type TileHeader } from '@windy/TileLayerUtils';
import { PreprocessedTileParams } from '@windy/TilePreprocessor';
import type { FullRenderParameters } from '@windy/interfaces';
/**
 * A refactored TileLayer preprocessor intended for use with the new tile management.
 * Assumes that it is only created once for a given set of render params and then disposed when render params change.
 * Render params may not be changed after initialization.
 */
export declare class TileLayerPreprocessorStandalone {
    private static _textures;
    private static _texturesLoadPromise;
    private _renderer;
    private _primaryGradient?;
    private _secondaryGradient?;
    private _renderProperties;
    private _ptypeColors;
    private _params;
    private _gl;
    private _initialized;
    private _destroyed;
    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, params: FullRenderParameters);
    init(): Promise<void>;
    /**
     * Renders a tile with the preprocessing shader into the currently bound framebuffer.
     */
    renderTile(gl: WebGLRenderingContext | WebGL2RenderingContext, tileTexture: WebGLTexture, tileHeader: TileHeader, tileParams: PreprocessedTileParams): void;
    destroy(): void;
    private _bindUniforms;
    /**
     * @summary Initializes the preprocessor renderer including its shader program and geometry
     */
    private _initRenderer;
    /**
     * @summary Function called on each params update (in case user changed color palette)
     */
    private _createUpdateGradients;
    /**
     * Ensures that pattern textures are loaded.
     * Either initiates the load and awaits it, or,
     * if the textures are already loaded, returns immediately.
     * If called while the textures are loading, waits until they are ready.
     */
    private _prepareTextures;
    private static _prepareTextures;
}
