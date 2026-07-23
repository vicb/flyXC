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
  private static _textures;
  private static _texturesLoadPromise;
  private _rendererCache;
  private _enabled;
  private _hasSea;
  private _landOnly;
  private _latestParams;
  private _switchableCache;
  private _cloudsPatternGradient?;
  private _cloudsPatternGradientDirty;
  private _currentOverlay;
  readonly eventManager: EventManager;
  readonly type: 'custom';
  id: string;
  constructor(layerId: string, params: FullRenderParameters);
  get switchableCache(): any;
  render(gl: WebGLRenderingContext | WebGL2RenderingContext, _options: CustomRenderMethodInput): void;
  onAdd(maplibreMap: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  /**
   * @summary Hides/shows the layer
   *   - useful for example in case when we cycle between various TileLayer renderers
   *   - for the old one (e.g. accumulation) we need to hide the layer and for the new one (e.g. tileLayer) we need to show it
   */
  enableDisableLayer(enable: boolean): void;
  paramsChanged(newParams: FullRenderParameters, layerReopen?: boolean): void;
  onRemove(_maplibreMap: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
  private _debugPrintTiles;
  private _selectRenderer;
  private _destroyRenderers;
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
  /**
   * @summary Function called on each params update (in case user changed color palette)
   */
  private _getCloudsPatternGradient;
  /**
   * Ensures that pattern textures are loaded.
   * Either initiates the load and awaits it, or,
   * if the textures are already loaded, returns immediately.
   * If called while the textures are loading, waits until they are ready.
   */
  private _prepareTextures;
  private static _prepareTextures;
}
