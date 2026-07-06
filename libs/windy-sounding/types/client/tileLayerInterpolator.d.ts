import type {
  PixelInterpolationFun,
  CoordsInterpolationFun,
  InterpolatorPossibleReturns,
} from '@windy/interpolatorTypes';
import type { FullRenderParameters } from '@windy/interfaces';
type TileLayerPickerCallback = (f1: CoordsInterpolationFun, f2: PixelInterpolationFun | (() => null)) => void;
export declare class TileLayerInterpolator {
  private _debugElement?;
  private _pixelReader;
  private _lastDataZoom;
  private _pendingLoads;
  private _latestParams?;
  private _requestGiveId;
  private _cache;
  private _cachedRequestsByTileUrl;
  constructor();
  paramsChanged(params: FullRenderParameters): void;
  /**
   * Request to build interpolate function for purpose of picker & other stuff
   * and since DataTiler is async, returns this function
   * in a callback
   */
  createFun(callback: TileLayerPickerCallback): void;
  destroy(): void;
  /**
   * @summary Samples data from map under the given mercator coordinates
   * @param mercatorX Mercator X relative coordinate in range <0.0, 1.0>
   * @param mercatorY Mercator Y relative coordinate in range <0.0, 1.0>
   * @returns Decoded and interpolated value (ready for display)
   */
  sampleAtMercator(
    mercatorX: number,
    mercatorY: number,
    abort?: AbortController,
    renderParams?: FullRenderParameters,
  ): Promise<InterpolatorPossibleReturns>;
  private _getIntZoom;
  private _onZoomEnd;
  private _keyDeleted;
  private _clearAllWaitingTiles;
  /**
   * @summary Performs the actual read from the tile texture
   * @param tile Tile to sample
   */
  private _sampleDataFromTile;
}
export declare const tileLayerInterpolator: TileLayerInterpolator;
export {};
