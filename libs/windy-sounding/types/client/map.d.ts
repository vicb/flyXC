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
import type { LatLon } from '@windy/interfaces.d';
import type { Pixel } from '@windy/types';
/**
 * Already initialized instance of Leaflet L.Map
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
export declare const map: L.Map;
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
 * const myPulsatingMarker = L.marker([ 50, 14 ], {
 *     icon: markers.pulsatingIcon
 *   }).addTo( map );
 * ```
 */
export declare const markers: Record<string, L.DivIcon>;
/**
 * @ignore
 */
export interface CenterOptions extends LatLon {
  zoom?: number;
  paddingTop?: number;
}
/**
 * Centers/zooms leaflet map with optional offset to the left or top
 * @ignore
 */
export declare function centerMap(coords: CenterOptions, animation?: boolean): void;
/**
 * Makes sure point is visible from bottom of the pane (will be depreciated)
 * @ignore
 */
export declare function ensurePointVisibleY(lat: number, lon: number, offset: number): void;
/**
 * Makes sure, that y coordinate on the map is coordinated with  lat, lon provided.
 * Useful for mobile picker & such
 * @ignore
 */
export declare function panToOffset(y: Pixel, lat: number, lon: number): void;
/**
 * Changes base map of underlying Windy.com map.
 * @ignore
 */
export declare const baseLayer: L.GridLayer;
/**
 * Retrieves the map tiles from the mapTilesRecord.
 * @ignore
 * @returns The map tiles.
 */
export declare const getMapTiles: (patchType?: string) => Record<import('@windy/baseMap').MapTilesKeys, string>;
