export type MapTilesKeys =
  | 'graymap'
  | 'landmaskmap'
  | 'simplemap'
  | 'graymapPatch5'
  | 'graymapPatch11'
  | 'simplemapPatch5'
  | 'simplemapPatch9'
  | 'sznmap'
  | 'winter'
  | 'satLocal'
  | 'sat';
/**
 * Return just record of different map tilesURLs that we use as basemap
 */
export declare const mapTilesRecord: (patchType?: string | null) => Record<MapTilesKeys, string>;
/**
 * Adds basemap to Leaflet map or updates source of tiles it if already exists
 */
export declare function addOrUpdateBasemap(map: L.Map): void;
/**
 * Remove basemap from Leaflet map
 */
export declare function removeBasemap(map: L.Map): void;
