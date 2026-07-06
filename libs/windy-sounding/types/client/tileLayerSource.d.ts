import { LeafletGlMap, type CacheAllocationToken } from '@leafletGl';
import { type TileHeader } from '@windy/TileLayerUtils';
import { Evented } from '@windy/Evented';
export type CachedTile = {
    /**
     * When true, the tile has valid data.
     * When false, the loading of the tile has failed.
     */
    valid: true;
    /**
     * The WebGL texture containing this tile's image, without the header.
     * Default filtering is linear and wrap mode is clamp-to-edge.
     * Tile image size is 257x257.
     */
    tex: WebGLTexture;
    /**
     * The extracted tile header.
     */
    header: TileHeader;
    url: string;
} | {
    valid: false;
    url: string;
};
type TileLayerSourceEvents = {
    /**
     * @ignore
     */
    keydeleted: string;
};
/**
 * A reference counted cache for loading generic TileLayer tiles.
 * Automatically extracts tile headers and uploads the images into WebGL textures.
 */
declare class TileLayerSource extends Evented<TileLayerSourceEvents> {
    private _gl;
    private _cache;
    private _canvas;
    private _ctx;
    private _disposed;
    constructor();
    /**
     * Initializes the tile source with a WebGL context.
     */
    init(map: LeafletGlMap): void;
    /**
     * Asynchronously gets a tile. The returned token must later be "freed" by passing it to {@link free}.
     * The returned texture is kept in cache for as long as any token referencing it exists.
     * Same semantics as {@link ReferenceCountedCache.retrieve}.
     */
    get(url: string, abort?: AbortSignal): Promise<CacheAllocationToken<CachedTile>>;
    /**
     * Waits for a tile for a given url to be loaded, but does not trigger the load itself.
     * Loading of the value must be started elsewhere by calling {@link get}.
     * Returned token must later be freed using {@link free}, same as with tokens returned from {@link get}.
     */
    awaitTile(url: string, abort?: AbortSignal): Promise<CacheAllocationToken<CachedTile>>;
    /**
     * Returns a token and deletes its associated texture if it is no longer needed. Same semantics as {@link ReferenceCountedCache.delete}.
     */
    free(tile: CacheAllocationToken<CachedTile>): void;
    /**
     * Releases all resources held by this TileLayerSource.
     */
    dispose(): void;
    private _imageBitmapToUint8Array;
}
/**
 * A singleton instance of a {@link TileLayerSource}.
 */
export declare const tileLayerSource: TileLayerSource;
export declare function fetchImageBlob(url: string, signal?: AbortSignal): Promise<Blob | null>;
export declare function extractTileHeader(imageBitmapWithHeader: ImageBitmap): Promise<ImageAndHeader>;
export type DecodedTile = {
    image: ImageBitmap | null;
    url: string;
};
export type ImageAndHeader = {
    image: ImageBitmap;
    header: TileHeader;
};
export type DecodedTileWithHeader = {
    url: string;
    imageAndHeader: ImageAndHeader | null;
    /**
     * @internal
     * Internal, do not use or modify.
     *
     * Tiles with header internally use the headerless cache to fetch the image,
     * and only then they extract the header.
     * This is the allocation token of the unprocessed tile image referenced by this tile.
     */
    _headerlessToken: CacheAllocationToken<DecodedTile>;
};
export type TileToken<T extends DecodedTile | DecodedTileWithHeader> = CacheAllocationToken<T> & {
    _hasHeader: T extends DecodedTileWithHeader ? true : false;
};
export {};
