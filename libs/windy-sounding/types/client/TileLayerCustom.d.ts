import { MapLibreMap } from '@leafletGl';
import { EventManager } from '@windy/EventManager';
import type { CustomLayerInterface, CustomRenderMethodInput } from '@leafletGl';
import type { FullRenderParameters } from '@windy/interfaces';
/**
 * This is the "main" layer class for rendering forecast layers.
 * It implement's MapLibre's custom layer interface (`onAdd`, `onRemove` and `render`)
 * and several helper methods for handling render params change and layer enable/disable.
 */
export declare class TileLayerCustom implements CustomLayerInterface {
  private _renderer;
  private _enabled;
  private _hasSea;
  private _landOnly;
  private _latestParams;
  private _switchableCache;
  private _paramsChangeId;
  readonly eventManager: EventManager;
  readonly type: 'custom';
  id: string;
  constructor(layerId: string, params: FullRenderParameters);
  get switchableCache(): any;
  render(gl: WebGLRenderingContext | WebGL2RenderingContext, _options: CustomRenderMethodInput): void;
  onAdd(_maplibreMap: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Hides/shows the layer
   *   - useful for example in case when we cycle between various TileLayer renderers
   *   - for the old one (e.g. accumulation) we need to hide the layer and for the new one (e.g. tileLayer) we need to show it
   */
  enableDisableLayer(enable: boolean): void;
  paramsChanged(newParams: FullRenderParameters, layerReopen?: boolean): void;
  onRemove(_maplibreMap: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  private _init;
  private _onUpdate;
  /**
   * Sets land or sea mask visibility.
   * Called when {@link _switchableCache} switches to a new set of tiles
   * or when {@link _switchableCache} is first created.
   */
  private _updateLandSeaMask;
  /**
   * Creates a tile cache from the current {@link _latestParams}
   * and passes this cache to {@link _switchableCache}.
   *
   * If no instance of {@link _switchableCache} exists, it is created.
   * and {@link _updateLandSeaMask} is called.
   *
   * Call when {@link _latestParams} changes.
   */
  private _updateCache;
}
