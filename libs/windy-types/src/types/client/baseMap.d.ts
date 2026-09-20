export type MapTilesKeys = 'graymap' | 'landmaskmap' | 'simplemap' | 'graymapPatch5' | 'graymapPatch11' | 'simplemapPatch5' | 'simplemapPatch9' | 'sznmap' | 'winter' | 'satLocal' | 'sat';
/**
 * Last zoom level at which the gray base map is displayed.
 * At higher zooms, outdoor map is used instead.
 */
export declare const grayMapZoomEnd = 11;
/**
 * Return just record of different map tilesURLs that we use as basemap
 */
export declare const mapTilesRecord: (patchType?: string | null) => Record<MapTilesKeys, string>;
export declare const baseMapLayerId = "raster-basemap";
/**
 * Adds basemap to Leaflet map or updates source of tiles it if already exists
 */
export declare function addOrUpdateBasemap(): void;
/**
 * Remove basemap from Leaflet map
 */
export declare function removeBasemap(): void;
/**
 * Move basemap to a new bucket
 */
export declare function reorderBasemapLayer(newBucketId: number): void;
