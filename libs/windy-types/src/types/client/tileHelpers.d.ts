import { type TileHeader } from '@windy/TileLayerUtils';
import { Bounds, TileCache, type CacheAllocationToken, type Coords } from '@leafletGl';
import { GlTexture } from '@windy/glUtils';
import { type CachedTile } from '@windy/tileLayerSource';
import type { FullRenderParameters } from '@windy/interfaces';
declare const tileDebugStateMap: {
    readonly missing: "-";
    readonly waitingForDataTile: "W";
    readonly dataTileFailed: "F";
    readonly dataTileAborted: "A";
    readonly dataTileInvalid: "I";
    readonly contextLostDuringProcessing: "C";
    readonly success: "S";
    readonly deleted: "D";
};
type TileDebugState = keyof typeof tileDebugStateMap;
export type TileDebugInfo = {
    state: TileDebugState;
    message?: string;
    coords: Coords;
};
export declare function getSummaryDebugTileInfo(bounds: Bounds, z: number, infoMap: Map<string, TileDebugInfo>): string;
type OnCacheDestroy = () => void;
export type Cache<TTile> = {
    cache: TileCache<TTile>;
    /**
     * Completely cleans up the cache: disposes of the internal TileCache, un-registers event listeners, cleans up tile preprocessor.
     */
    destroy: OnCacheDestroy;
    /**
     * Map of tile coords key string -> debug info
     */
    debug?: Map<string, TileDebugInfo>;
};
export type ReadyTile = {
    valid: true;
    tex: GlTexture;
    coords: Coords;
    dataHeader: TileHeader;
    dataTex: WebGLTexture;
    dataUniforms: {
        dataTileScaleOffset: number[];
        sizeS: number;
        srcPixelSize: number;
    };
    _token: CacheAllocationToken<CachedTile>;
} | {
    valid: false;
    _token: CacheAllocationToken<CachedTile>;
};
/**
 * Helper functions that creates a (Tile)Cache instance for use in Windy's TileLayer.
 * The cache is configured to use {@link tileLayerSource} to fetch tiles and headers
 * and then preprocess them on the GPU using {@link TileLayerPreprocessorStandalone}
 * configured to the supplied {@link FullRenderParameters}.
 *
 * The returned `Cache` object contains the `TileCache` instance and a `destroy`
 * function for disposing of the {@link TileLayerPreprocessorStandalone}.
 * (But NOT the `TileCache`! It must be destroyed separately.)
 *
 * This function is async, since it must wait for the {@link TileLayerPreprocessorStandalone} to initialize.
 *
 * @param params - Full render parameters for the desired layer.
 */
export declare function makeTileLayerCache(params: FullRenderParameters): Cache<ReadyTile>;
/**
 * Replaces {z}, {x} and {y} in the URL template with the given tile coords.
 */
export declare function applyUrlTemplate(urlTemplate: string, coords: Coords): string;
export {};
