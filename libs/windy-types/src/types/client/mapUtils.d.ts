import { LngLatBounds } from '@leafletGl';
import type { LatLngBounds, LngLatBoundsLike } from '@leafletGl';
import type { BoxBounds2D } from './d.ts.files/math';
export declare const MAPLIBRE_TILE_SIZE = 512;
export declare const utils: {
    isWebGl2: boolean;
    /** WebGL context type key - used to access context-relevant shaders sources */
    context: "WGL1" | "WGL2";
};
/**
 * @summary Computes nearest integer zoom w.r.t the supplied zoom offset (in case of different tile size than 512px) and optional upper bound
 * @param map
 * @param zoomOffset
 * @param upperBound
 */
export declare function getSafeZoom(zoomOffset: number, upperBound?: number): number;
/**
 * @summary Enumerates visible world copies for the current viewport state
 * @param map MapLibre map used to query current viewport state
 * @returns Array of integers representing each copy and its "position" in the repeated world coordinates (e.g. [-1, 0 = canonical, 1, 2])
 */
export declare function getWorldVisibleRectOffsets(): number[];
/**
 * @summary Coverts MapLibre LngLat bounds to mercator bounding box with coordinates in range <0.0,1.0>
 * @param bounds
 */
export declare function lngLatBoundsToMercator(bounds: LngLatBounds): BoxBounds2D;
/**
 * Viewport tile padding, 1 = viewport is padded by one tile on each side
 *  - required mainly for data extrapolation since data outside of viewport have to be accessed
 */
export declare const tilePaddingSize: number;
/**
 * @summary Computes viewport tile bounds defined in tile coordinates for current map viewport and zoom
 *          - in case of padding is defined, returns tile bounds computed from the padded lat-lon bounds
 * @param map
 * @param zoom
 */
export declare function getTileBounds(zoom: number, toCanonical?: boolean): BoxBounds2D;
/**
 * @summary Converts tile bounds to Maplibre LngLatBounds
 * @param tileBounds Tile bounds in tile coordinates
 * @param zoom Integer (rounded) zoom w.r.t. the supplied tile bounds
 */
export declare function tileBoundsToLatLonBounds(tileBounds: BoxBounds2D, zoom: number): LngLatBounds;
/**
 * @summary Converts lat-lon bounds (defined either as MapLibre LngLatBounds or as BoxBounds2D) to bounds defined in tile coordinates
 * @param latLonBounds
 * @param zoom Integer (rounded) zoom for which to compute the tile bounds
 */
export declare function latLonBounds2TileBounds(latLonBounds: LngLatBounds | BoxBounds2D, zoom: number): BoxBounds2D;
/**
 * @summary Since maplibre tile zoom is based on default tile size 512px, other sizes lead to different zoom (e.g. 256px has zoom + 1...)
 *  - that means, that while map is having zoom 5, the tile with different tile size can have zoom 6
 * @param tileSizeInPixels For which tile size to compute zoom offset
 * @returns {number} Zoom offset delta to be added to the queried map zoom
 */
export declare function tileSizeToZoomOffset(tileSizeInPixels: number): number;
/**
 * Converts Leaflet geodesic bounds to maplibre bounds
 * @param lineBounds Geodesic bounds
 * @returns {LngLatBoundsLike}
 */
export declare function geoBoundsToMaplibreBounds(lineBounds: LatLngBounds): LngLatBoundsLike;
export declare function createPlaceholderImageCanvas(noDataPattern: boolean, cssColor?: string): HTMLCanvasElement;
export declare function createPlaceholderImage(noDataPattern: boolean, cssColor?: string): Promise<HTMLImageElement>;
export declare function queryWebGlVersion(): void;
