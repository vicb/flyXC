import type { DataTile } from '@windy/dataLoader';
import type { TileParams } from '@windy/Renderer';
import type { TileLayerCanvas } from '@windy/TileLayerCanvas.d';
declare const renderNoDataTile: (canvas: HTMLCanvasElement, url?: string) => void;
declare const renderTile: (
  this: TileLayerCanvas,
  _step: 1 | 2,
  canvas: HTMLCanvasElement,
  rqrdSyncNum: number,
  tInfo: TileParams,
  dTile: DataTile,
) => void;
export { renderNoDataTile, renderTile };
