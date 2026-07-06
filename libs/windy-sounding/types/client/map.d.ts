/**
 * # @windy/map
 *
 * Already initialized instance of Leaflet map and other map related functions and stuff
 *
 * Instance of Leaflet map is available as `map` in this module.
 *
 * Windy.com uses Leaflet version `1.4.0` that is [well documented here](http://leafletjs.com/)
 * and contains plenty of [plugins that you can use](http://leafletjs.com/plugins.html).
 *
 * @module map
 */
import { DivIcon } from '@leafletGl';
import type { LatLon } from '@windy/interfaces.d';
import type { Pixel } from '@windy/types';
/**
 * Use this object to lookup proper order IDs for different layers.
 * Higher order ID layers always draw on top of lower order ID layers.
 */
export declare const layerOrder: {
  /**
   * Used for the colored land-sea layer. Bottom of the stack.
   */
  LANDSEA_MASK_COLORED: number;
  /**
   * Main bucket for weather layers. Draws above the colored land/sea mask, but below everything else.
   */
  MAIN: number;
  /**
   * Bucket for rendering satellite layer.
   */
  SATELLITE: number;
  /**
   * Bucket for rendering radar layer.
   */
  RADAR: number;
  /**
   * Particles overlay.
   */
  PARTICLES: number;
  /**
   * Land/sea mask, to mask out some parts of the main weather map.
   */
  LANDMASK_SEAMASK: number;
  /**
   * Used for the raster base map (the mostly transparent one with borders and outlines of water bodies).
   * Draws above the weather layers and land/sea mask.
   */
  BASE_MAP: number;
  /**
   * Bucket where particles are moved if the map is zoomed in enough to show outdoor map instead of the grey base map.
   */
  PARTICLES_HIGH_ZOOM: number;
  /**
   * Airspaces map overlay.
   */
  AIRSPACES: number;
  /**
   * WebGL POIs overlay (e.g. fire-spots).
   */
  WEBGL_POIS: number;
  /**
   * Hurricane overlay.
   */
  HURRICANES: number;
  /**
   * Isolines overlay.
   * Display on top of both hurricanes and airspaces, since neither contains any text (at least not in their canvases), but isolines do have text.
   * Note that hurricane markers/popups will display above all MapLibre layers, including this one.
   */
  ISOLINES: number;
};
/**
 * Already initialized instance of LeafletGL Map
 *
 * @example
 * ```js
 * import { map } from '@windy/map';
 *
 * map.on('zoomend', () => {
 *    console.log('Map was zoomed');
 * });
 * ```
 */
export declare const map: any;
/**
 * Already initialized reusable set of minimalistic Leaflet markers
 *
 * `icon` Pulsating icon
 *
 * `pulsatingIcon` Pulsating icon forever
 *
 * `myLocationIcon` Blue icon of user's location
 *
 * @example
 * ```js
 * import { map, markers } from '@windy/map';
 *
 * const myPulsatingMarker = marker([ 50, 14 ], {
 *     icon: markers.pulsatingIcon
 *   }).addTo( map );
 * ```
 */
export declare const markers: Record<string, DivIcon>;
/**
 * @ignore
 */
export interface CenterOptions extends LatLon {
  zoom?: number;
  paddingTop?: number;
  paddingLeft?: number;
}
/**
 * Centers/zooms leaflet map with optional offset to the left or top
 * @ignore
 */
export declare function centerMap(coords: CenterOptions, animation?: boolean): void;
/**
 * Makes sure point is visible from bottom of the pane (will be deprecated)
 * @ignore
 */
export declare function ensurePointVisibleY(lat: number, lon: number, offset: number): void;
/**
 * Makes sure, that y coordinate on the map is coordinated with  lat, lon provided.
 * Useful for mobile picker & such
 * @ignore
 */
export declare function panToOffset(y: Pixel, lat: number, lon: number): void;
export declare let hasMask: boolean;
export declare function toggleLandMask(enableMask: boolean): void;
export declare function toggleSeaMask(enableMask: boolean): void;
export declare function toggleLandSeaMaskColored(enableMask: boolean): void;
/**
 * Retrieves the map tiles from the mapTilesRecord.
 * @ignore
 * @returns The map tiles.
 */
export declare const getMapTiles: (patchType?: string) => Record<import('@windy/baseMap').MapTilesKeys, string>;
/**
 * Just handy shortcut to detect that globe is active
 */
export declare const isGlobeActive: () => boolean;
type LoadCallback = (...args: unknown[]) => void;
export declare function whenMapInitialized(callback: LoadCallback): void;
/**
 * Requests the presence of a large loader, or removes such request.
 * Each loader request is tied to some `id` - any unique identifier of a component that requested it.
 * A loader is displayed for as long as any component requests one.
 *
 * Calling the function with `setTileLayerLoader(id, true)` when the loader was already requested before has no effect,
 * and calling it with `setTileLayerLoader(id, false)` when the loader was already removed also has no effect.
 *
 * Example: both "tileLayer" and "cityLabels" might be requesting the presence of a loader, but "cityLabels" are done loading
 * before "tileLayer" and remove their request, but the loader is still visible until "tileLayer" also removes its loader request.
 * @param id - The string identifier of the calling component.
 * @param loaderActive - Whether a loader is requested or not.
 *
 * @example
 * ```ts
 * const loaderId = "tileLayer";
 * // Start of loading - we request a loader:
 * setTileLayerLoader(loaderId, true);
 * // Actually load something
 * await loadSomething();
 * // Remove our loader request:
 * setTileLayerLoader(loaderId, false);
 * ```
 */
export declare function setTileLayerLoader(id: string, loaderActive: boolean): void;
export {};
