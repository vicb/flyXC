import { Calendar } from '@windy/Calendar';
import { type LeafletGlMap } from '@leafletGl';
import type { MinifestObject } from '@windy/Calendar';
import type { Layers } from '@windy/Layer';
import type { LatLon } from '@windy/interfaces';
import type { Isolines, Levels, Overlays, Products } from '@windy/rootScope.d';
import type { ISODateString, ProductCategory, ProductIdent, Timestamp, TimeRangeMs, Path, Minutes } from '@windy/types';
export type DataQuality = 'normal' | 'high' | 'low' | 'ultra' | 'extreme';
export type FileSuffix = 'png' | 'jpg' | 'webp';
export type ProductInitParams = Pick<Product, 'modelName' | 'provider' | 'interval'> &
  Partial<
    Pick<
      Product,
      | 'provider'
      | 'ident'
      | 'maxTileZoom'
      | 'animationSpeed'
      | 'animationSpeed1h'
      | 'fileSuffix'
      | 'fileSuffixFallback'
      | 'JPGtransparency'
      | 'PNGtransparency'
      | 'dataQuality'
      | 'betterDataQuality'
      | 'animation'
      | 'labelsTemp'
      | 'overlays'
      | 'preferredProduct'
      | 'isolines'
      | 'directory'
      | 'category'
      | 'modelIdent'
      | 'intervalPremium'
      | 'server'
      | 'modelResolution'
      | 'levels'
      | 'levelsOverride'
      | 'logo'
      | 'preferredWaveProduct'
      | 'preferredAirProduct'
      | 'hasAccumulations'
      | 'hasMinifest'
      | 'freeProduct'
      | 'hideProductSwitch'
      | 'modelDescription'
      | 'supportsMeteogram'
    >
  > & {
    forecastSize?: number;
    bounds?: [number, number][][];
  };
export declare class Product {
  /**
   * Boundaries of the product in a format [[north, west], [north, east], [south, east], [south, west]] or any more accurate polygon
   */
  private bounds?;
  protected minifestExpirationTime: TimeRangeMs;
  /**
   * Minifest loading promise
   */
  protected loadingPromise?: null | Promise<Calendar | undefined | void>;
  /**
   * Must contain ident of self
   */
  ident: Products;
  /**
   * Maximum data tile resolution
   */
  maxTileZoom?: {
    free: number;
    premium: number;
  };
  /**
   * Speed of animation in timestamp seconds per normal second
   *
   * for example 3600 = 1h per 1 second
   */
  animationSpeed: number;
  animationSpeed1h: number;
  /**
   * Default fileSuffix. Can be overwriten by overlay
   */
  fileSuffix: FileSuffix;
  /**
   * Backup fileSuffix if fileSuffix not supported (used if webp not supported)
   */
  fileSuffixFallback?: FileSuffix;
  /**
   * Overlay uses transparency defined in B channel in JPG
   */
  JPGtransparency: boolean;
  /**
   * Overlay uses transparency defined in A channel in PNG
   */
  PNGtransparency: boolean;
  /**
   * Quality of downloaded data for this
   * product. Can be overwritten by overlay
   */
  dataQuality: DataQuality;
  /**
   * Array of layers, where data quaility is one step
   * better than 'dataQuality'. For instance ['rain','clouds']
   */
  betterDataQuality: Layers[];
  /**
   * Play/pause animation of this products is possible
   */
  animation: boolean;
  /**
   * Calendar used for this product
   * (created during initialization)
   */
  calendar?: Calendar;
  /**
   * Description of product for purpose of UI
   */
  modelName: string | '';
  modelResolution?: number;
  provider?: string;
  /**
   * Optional model description
   */
  modelDescription?: string;
  /**
   * Update interval (in minutes)
   */
  interval: Minutes;
  intervalPremium?: Minutes;
  /**
   * Usual length of forecast in hours (used upon creation of backup minifest)
   */
  forecastSize: number;
  /** Directory (path in URL) on image server, if not provided, `category/modelIdent` is used */
  directory: string;
  /**
   * Category of the model
   */
  category?: ProductCategory;
  /**
   * Server side model ident, used by DS and other BE services
   * This should replace `ident` at some point, becasue `ident` is used only on client and BE needs to convert it to `modelIdent`
   */
  modelIdent?: ProductIdent;
  /**
   * Model can be used for temeperature in labels
   */
  labelsTemp: boolean;
  /**
   * Logo of provider in rh-bottom
   */
  logo?: string;
  /**
   * List of avail overlays
   */
  overlays: Overlays[];
  /**
   * List of avail levels
   */
  levels?: Levels[];
  /**
   * Override for when some has different levels from rest of model
   */
  levelsOverride?: Partial<Record<Layers, Levels[]>>;
  /**
   * List of avail isolines
   */
  isolines: Isolines[];
  /**
   * If we drag out of bounds, which product we should use (must be global air product)
   */
  preferredProduct: 'ecmwf' | 'gfs' | 'icon' | 'iconEu';
  /**
   * Preferred product when switching to wave layers
   */
  preferredWaveProduct: Products;
  /**
   * Preferred product when switching to air layers
   */
  preferredAirProduct: Products;
  /**
   * Holder of the latest minifest
   */
  minifest?: MinifestObject | null;
  /**
   * Alternative servers, where the data are loaded from
   */
  server?: string;
  /**
   * Some product doesn't have meaningful
   * information about the model and time of the next update.
   * Set this to false to hide the info where not relevant (f.ex. Info plugin)
   */
  hasMinifest: boolean;
  /**
   * This product supper accumulations
   */
  hasAccumulations?: boolean;
  /**
   * This product is free for all users during whole timeline
   */
  freeProduct?: boolean;
  /**
   * Hide product switch in GUI, when this product is selected
   */
  hideProductSwitch?: boolean;
  /**
   * Time when minifest was last updated
   */
  minifestLastUpdate?: Timestamp;
  /**
   * Point fcst backend for this product supports airgram/meteogram
   */
  supportsMeteogram?: boolean;
  constructor(params: ProductInitParams);
  getRefTimeISOFormat(): Promise<ISODateString | undefined>;
  getRefTime(): Promise<Path | undefined>;
  /**
   * Loads & returns a minifest. Since our @windy/http module has its own cache, we don't need to
   * cache ongoing requests promise and simplify the code as much as possible
   */
  loadMinifest(): Promise<MinifestObject>;
  /**
   * Checks if lat,lon is within bounds
   */
  pointIsInBounds<T extends LatLon>(this: this, paramsMap: T): boolean;
  /**
   * Detects if the the bounds are in viewport
   */
  boundsAreInViewport(map: LeafletGlMap): boolean;
  close(): void;
  open(): void;
  getCalendar(): Promise<Calendar | undefined>;
  private isPointInsidePolygon;
}
