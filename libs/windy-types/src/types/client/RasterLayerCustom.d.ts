import { MapLibreMap, type CustomLayerInterface, type CustomRenderMethodInput } from '@leafletGl';
import type { TileDef } from '@windy/TileLayerMulti';
export type RasterLayerVariant = 'default' | 'landMask' | 'seaMask' | 'coloredLandSea';
type CacheOptions = {
    minZoomSource: number;
    maxZoomSource: number;
};
export type RasterLayerOptions = CacheOptions & {
    /**
     * Strings {x}, {y} and {z} will be replaced with tile coordinates. {s} for subdomains is not supported.
     */
    url: string;
    /**
     * Note: {s} for subdomains is not supported.
     */
    tileDefs?: Record<number, TileDef>;
    variant?: RasterLayerVariant;
    minZoomDisplay?: number;
    maxZoomDisplay?: number;
    zoomBias?: number;
};
/**
 * This is the "main" layer class for rendering forecast layers.
 * It implement's MapLibre's custom layer interface (`onAdd`, `onRemove` and `render`)
 * and several helper methods for handling render params change and layer enable/disable.
 */
export declare class RasterLayerCustom implements CustomLayerInterface {
    private static _shader;
    private _tileCache;
    private _options;
    private _shaderDefines;
    private _map;
    readonly type: "custom";
    id: string;
    constructor(layerId: string, options: RasterLayerOptions);
    onAdd(map: MapLibreMap): void;
    onRemove(map: MapLibreMap, _gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void;
    private _drawTiles;
    private _onMapMove;
}
export {};
