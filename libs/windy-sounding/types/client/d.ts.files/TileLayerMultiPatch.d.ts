export class TileLayerMultiPatch extends L.TileLayerMulti {
  _tileDefs?: Record<number, L.TileDef | null>;
  _tileDefsBase?: Record<number, L.TileDef | null>;
  _tileDefsPatch?: Record<number, L.TileDef | null>;
  _patch?: Record<number, number[]>;
  initialize(this: this, tileDefs?: Record<number, L.TileDef>, options?: L.TileLayerOptions): void;
  getTileUrl(this: this, tilePoint: L.Point): string;
  _convertPatchToZoom(this: this, patch: L.TileDefPatch, zoom: number): number[];
}
