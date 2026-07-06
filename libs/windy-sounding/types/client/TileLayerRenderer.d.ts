import { GlRenderer } from '@windy/glUtils';
import type { ReadyTile } from '@windy/tileHelpers';
import type { SwitchableTileCache } from '@windy/SwitchableTileCache';
/**
 * Handles rendering of already preprocessed tiles with a simple shader.
 * Does not depend on current map/render params,
 * only needs a {@link SwitchableTileCache} instance in order to render its tiles.
 * Has no internal state other than compiled shaders and empty placeholder texture.
 */
export declare class TileLayerRenderer extends GlRenderer {
    private _emptyPlaceholderTexture;
    private _bindings;
    constructor(gl: WebGL2RenderingContext | WebGLRenderingContext);
    render(_gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * Renders the layer using the currently loaded tiles in the current cache of the supplied SwitchableTileCache.
     */
    renderTiles(gl: WebGL2RenderingContext | WebGLRenderingContext, cache: SwitchableTileCache<ReadyTile>): void;
    /**
     * @summary Renderer destructor
     */
    destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    private _initializeRenderer;
}
