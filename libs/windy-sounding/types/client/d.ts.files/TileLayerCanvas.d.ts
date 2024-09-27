import { DataTile } from '@windy/dataLoader';

import { FullRenderParameters } from '@windy/Layer.d';
import { TileParams } from '@windy/Renderer.d';

export type InternalTile = L.InternalTiles[string] & { el: HTMLCanvasElement };

export class TileLayerCanvas extends L.GridLayer {
  _tiles: Record<string, InternalTile>;
  /**
   * Latest params
   */
  latestParams: FullRenderParameters;

  /**
   * Incrementing counter, that keeps latestParams and actually rendered ile in sync
   */
  syncCounter: number;

  /**
   * While map is being moved
   */
  inMotion: boolean;

  /**
   * Wis sea applied to CSS tag?
   */
  hasSea: boolean;

  landOnly: boolean;

  className: string;

  _tilesToLoad: number;

  /**
   * Owerwriting TileLayer method to disable redrawing layers w/o params
   */
  // @ts-expect-error We rape TS with overloading properties with properties of different input and output (TODO fix)
  onAdd(this: this, map: L.Map): this;
  onRemove(this: this, map: L.Map): this;
  onMoveStart(this: this): void;
  onMoveEnd(this: this): void;
  checkLoaded(this: this): void;
  redrawFinished(this: this): void;
  /**
   * Redrawing overlay after changing params
   *
   * 1. find visible tiles
   * 2. remove invisible tiles
   * 3. redraw visible tiles
   */
  redrawLayer(this: this): void;

  removeOtherTiles(this: this, zoom: number, tileBounds: L.Bounds): void;

  _removeTile(this: this, key: string): void;

  /**
   * Sort tiles from center out
   */
  sortTilesFromCenterOut(this: this, bounds: L.Bounds): L.Coords[];

  redrawTile(this: this, tile: InternalTile): void;

  paramsChanged(this: this, params: FullRenderParameters): void;

  init(this: this, params: FullRenderParameters): void;

  renderTile(
    this: this,
    step: 1 | 2,
    canvas: HTMLCanvasElement,
    rqrdSyncNum: number,
    tInfo: TileParams,
    dTile: DataTile,
  ): void;
}
