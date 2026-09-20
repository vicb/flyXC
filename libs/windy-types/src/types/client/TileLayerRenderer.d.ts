import { GlTexture, GlRenderer } from '@windy/glUtils';
import { type GradientProps } from '@windy/TileLayerUtils';
import type { ReadyTile } from '@windy/tileHelpers';
import type { SwitchableTileCache } from '@windy/SwitchableTileCache';
/**
 * Any texture that has failed to load will be null.
 */
export type PreprocessorTextures = {
    texturePType1: GlTexture | null;
    texturePType2: GlTexture | null;
    textureCCL: GlTexture | null;
    /**
     * The clouds layer rain pattern texture.
     * It is generated locally and is always present.
     */
    textureCloudsRain: GlTexture;
};
export type TileLayerRendererVariant = "DEFAULT" | "RAIN" | "CLOUDS" | "CCL";
/**
 * Handles rendering of already preprocessed tiles with a simple shader.
 * Does not depend on current map/render params,
 * only needs a {@link SwitchableTileCache} instance in order to render its tiles.
 * Has no internal state other than compiled shaders and empty placeholder texture.
 */
export declare class TileLayerRenderer extends GlRenderer {
    private _emptyPlaceholderTexture;
    private _variant;
    private _patternTranslator;
    private _bindings;
    constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, variant: TileLayerRendererVariant);
    render(_gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * Renders the layer using the currently loaded tiles in the current cache of the supplied SwitchableTileCache.
     */
    renderTiles(gl: WebGL2RenderingContext | WebGLRenderingContext, cache: SwitchableTileCache<ReadyTile>, cloudsPatternGradient: GradientProps, textures: PreprocessorTextures | null): void;
    /**
     * @summary Renderer destructor
     */
    destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    private _initializeRenderer;
}
