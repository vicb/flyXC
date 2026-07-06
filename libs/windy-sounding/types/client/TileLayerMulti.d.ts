import { TileLayer, type TileLayerOptions } from '@leafletGl';
/**
 * Rectangle coords at a specific zoom level; left and top are inclusive, right and bottom tiles excluded.
 * `[ left, top, right, bottom, zoom ]`
 */
export type TileDefPatch = [number, number, number, number, number];
export type TileDef = {
  /**
   * The main tile url.
   */
  url: string;
  subdomains?: string | string[];
  /**
   * Tile URL for the patch region, if any is present.
   */
  patchUrl?: string;
  /**
   * Rectangle coords at a specific zoom level; left and top are inclusive, right and bottom tiles excluded.
   * `[ left, top, right, bottom, zoom ]`
   */
  patch?: TileDefPatch;
};
/**
 * @class Wrapper class over LeafletGl's TileLayer used for loading data from various sources based on zoom.
 * These sources are defined in the {@link tileDefs} object.
 * Can optionally apply a "patch", a rectangular region which loads different tiles that the rest of the map.
 */
export declare class TileLayerMulti extends TileLayer {
  /**
   * Map of zoom level -> tile def.
   * Each tiledef contains:
   * - tile url
   * - patch region precomputed for the current zoom level (if a patch is present)
   * - patch tile url
   */
  private _preparedTileDefs;
  /**
   * Maps tile coords X/Y/Z to the index of the corresponding string segment when the tile url is split with `/`.
   */
  private _urlMapping;
  /**
   * Creates a TileLayerMulti object.
   * Each tile source url is defined by its url, its upper bound zoom level and an optional patch.
   * @param tileDefs - An object where a TileDef with a given numeric key is applied to all zoom levels
   * lower than and including its key and that are not yet covered by a different TileDef with a lower numeric key.
   * @param options - Standard TileLayer options. Optional.
   */
  constructor(tileDefs: Record<number, TileDef>, options?: TileLayerOptions);
  /**
   * @summary Handler for constructing the correct tile url based on the zoom
   */
  private _modifyTileRequest;
}
