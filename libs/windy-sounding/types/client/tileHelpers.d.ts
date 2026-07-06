import { type TileHeader } from '@windy/TileLayerUtils';
import { type CacheAllocationToken, type Coords } from '@leafletGl';
import { GlTexture } from '@windy/glUtils';
import { type CachedTile } from '@windy/tileLayerSource';
import type { Cache } from '@windy/SwitchableTileCache';
import type { FullRenderParameters } from '@windy/interfaces';
export type ReadyTile = {
    valid: true;
    tex: GlTexture;
    coords: Coords;
    header: TileHeader;
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
export declare function makeTileLayerCache(params: FullRenderParameters): Promise<Cache<ReadyTile>>;
/**
 * Replaces {z}, {x} and {y} in the URL template with the given tile coords.
 */
export declare function applyUrlTemplate(urlTemplate: string, coords: Coords): string;
