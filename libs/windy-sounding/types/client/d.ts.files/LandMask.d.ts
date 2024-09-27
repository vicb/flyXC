/**
 * Leaflet layer with alpha-inverse sea mask
 */
export class LandMask extends L.TileLayer {
  seaColorL: number;
  ctx: CanvasRenderingContext2D | null;
  _tileOnError(done: L.DoneCallback, tile: HTMLImageElement | HTMLCanvasElement, e: string | Event): void;
  getTempCtx(): CanvasRenderingContext2D | null;
  getTileUrl(coords: L.Coords): string;
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement | HTMLImageElement;
  createImageTile(coords: L.Coords, done: L.DoneCallback): HTMLImageElement;
  createCanvasTile(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement;
}
