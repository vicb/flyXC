import { type MapLibreMap } from '@leafletGl';
export type TileMeshSimple = {
    vbo: WebGLBuffer;
    ibo: WebGLBuffer;
    indexCount: number;
};
/**
 * Simple class for caching tile meshes.
 * Automatically deletes meshes that have not been used for some time.
 */
declare class TileMeshRepo {
    private _meshMap;
    private _accessIndex;
    private _lastCleanupAccessIndex;
    private _lastCleanupTimeMillis;
    /**
     * Returns a tile mesh for the given map instance, WebGL context and tile coordinates & tile border flag.
     * Uses a cache internally to reuse tile meshes.
     * This cache is periodically cleared of no longer used tile meshes.
     *
     * Use the returned tile mesh immediately, since at some point it may be deleted to save memory.
     * @param map  - The map instance.
     * @param gl - The WebGL context.
     * @param y - The tile's web mercator Y coordinate.
     * @param z - The tile's web mercator zoom.
     * @param border - Whether the tile's geometry should have a border. Borders are useful for avoiding gaps between tiles.
     * @returns
     */
    getTileMesh(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext, y: number, z: number, border: boolean): TileMeshSimple;
    private _cleanupCache;
    private _getOrCreateTileMesh;
}
/**
 * Use this object to obtain tile meshes using its {@link TileMeshRepo.getTileMesh} function.
 */
export declare const tileMeshRepo: TileMeshRepo;
export {};
