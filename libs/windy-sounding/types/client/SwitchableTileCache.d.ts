import { Bounds, LeafletGlMap, TileCache, type Coords } from '@leafletGl';
type OnCacheDestroy = () => void;
export type Cache<TTile> = {
  cache: TileCache<TTile>;
  /**
   * Completely cleans up the cache: disposes of the internal TileCache, un-registers event listeners, cleans up tile preprocessor.
   */
  destroy: OnCacheDestroy;
};
/**
 * This class serves as a tile cache with the added functionality of
 * being able to swap the internal set of tiles (internal tile cache)
 * for a new set of tiles, but only once the new tiles are fully loaded.
 *
 * This is useful for when you want to eg. swap current forecast refTime or model and only display the new data once it is fully ready.
 *
 * Additionally, this class supports {@link awaitTile} function, which asynchronously waits for a given tile to be loaded.
 * This does not trigger a new tile load, but waits for the tile to become required by the current map view.
 */
export declare class SwitchableTileCache<TTile> {
  private _nextCache;
  private _currentCache;
  private _keepBuffer;
  private _maxLowerZoom;
  private _maxHigherZoom;
  private _lastMapBounds;
  private _lastMapZoom;
  onSwitch?: () => void;
  get currentCache(): Cache<TTile>;
  get keepBuffer(): number;
  /**
   * Gets the map bounds, as computed at the last {@link update} call,
   * with {@link keepBuffer} taken into account.
   */
  get lastBounds(): Bounds;
  /**
   * Gets the map integer zoom, as computed at the last {@link update} call.
   */
  get lastZoom(): number;
  /**
   * Creates a new instance of {@link SwitchableTileCache}.
   * @param initialCache - The initial tile cache to be used.
   * @param keepBuffer - How many extra tiles in each of the four directions should be loaded in addition to the set that optimally covers the current map view.
   * @param maxLowerZoom - If a tile at the specified zoom level is unavailable, its parent or children may be rendered instead.
   * This value is the maximal allowed difference in zoom levels when rendering a **less** detailed tile instead of the ideal one.
   * @param maxHigherZoom - If a tile at the specified zoom level is unavailable, its parent or children may be rendered instead.
   * This value is the maximal allowed difference in zoom levels when rendering a **more** detailed tile instead of the ideal one.
   */
  constructor(initialCache: Cache<TTile>, keepBuffer?: number, maxLowerZoom?: number, maxHigherZoom?: number);
  /**
   * Initializes a switch to the supplied tile cache.
   * The current cache is switched for the supplied one once the supplied cache is done loading.
   * Loading of new tiles for the current cache is suspended in the meantime.
   * If a switch to another new cache was already taking place, then that new cache gets deleted.
   *
   * When you pass a cache to this function, you must not use that object directly anymore,
   * as it will now be managed and later disposed of by this class.
   *
   * You may not pass the same instance of a tle cache to this function multiple times.
   */
  setCache(cache: Cache<TTile>): void;
  /**
   * Updates the caches with the map's current view and zoom.
   * Call every time the map moves.
   */
  update(map: LeafletGlMap): void;
  /**
   * Returns an ordered array of tile coords that should be rendered to optimally cover the current map view.
   * May return tiles of different zoom level than what is optimal, depending on
   * what tiles are currently available and on the cache settings.
   * Is not affected by `keepBuffer`.
   */
  getRenderableCoords(): Coords[];
  /**
   * Returns the data in the current cache associated with the given tile.
   * May return `null` both when the tile load failed and when the tile is not present at all.
   * Distinguish between these two cases using {@link hasTile}.
   */
  getTile(coords: Coords): TTile | null;
  /**
   * Returns whether the current cache has loaded the given tile.
   */
  hasTile(coords: Coords): boolean;
  /**
   * Asynchronously returns a tile once it is loaded.
   * However the loading of this tile can only be triggered by the user moving the map
   * and the tile becoming visible in the map view.
   * Always returns tiles from the latest cache available at the time of calling this function:
   * returns tiles from the next cache, if any is present, otherwise returns tiles from the current cache.
   *
   * You can optionally supply an abort signal. Signalling it will cancel the tile request
   * and remove it from the internal queues.
   */
  awaitTile(coords: Coords, abort?: AbortSignal): Promise<any>;
  /**
   * Deletes all resources associated with this {@link SwitchableTileCache}, including its internal caches.
   */
  dispose(): void;
  /**
   * Updates one of the internal tile caches with up-to-date map bounds and zoom.
   */
  private _updateInternal;
}
export {};
