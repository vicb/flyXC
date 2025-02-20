import { Calendar } from '@windy/Calendar';
import * as http from '@windy/http';
import type { MinifestObject } from '@windy/Calendar.d';
import type { Layers } from '@windy/Layer.d';
import type { LatLon } from '@windy/interfaces';
import type { Isolines, Levels, Overlays, Products } from '@windy/rootScope.d';
import type { ISODateString, ProductCategory, ProductIdent, Timestamp, YYYYMMDDHH } from '@windy/types';
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
      | 'pathGenerator'
      | 'isolines'
      | 'directory'
      | 'category'
      | 'modelIdent'
      | 'intervalPremium'
      | 'server'
      | 'metadataServer'
      | 'modelResolution'
      | 'levels'
      | 'levelsOverride'
      | 'logo'
      | 'preferredWaveProduct'
      | 'preferredAirProduct'
      | 'hasAccumulations'
      | 'freeProduct'
      | 'hideProductSwitch'
    >
  > & {
    forecastSize?: number;
    bounds?: [number, number][][];
  };
export declare class Product {
  /**
   * Minifest loading promise
   */
  protected loadingPromise?: null | Promise<Calendar | undefined | void>;
  /**
   * Version of minifest used
   */
  protected infoVersion?: string;
  /**
   * minifest loading timer
   */
  private refreshInterval?;
  /**
   *  Timestamp of last minifest check
   */
  private minifestTimestamp;
  /**
   * Boundaries of the product in a format [[north, west], [north, east], [south, east], [south, west]] or any more accurate polygon
   */
  private bounds?;
  /**
   * Has binded listeners
   */
  private hasListeners;
  private bindedCheckNewMinifest;
  /**
   * When the product will expire (in ms)
   */
  private productExpires;
  /**
   * Noneffective, but simple refTime solutions for data that are updated once a day
   */
  protected dailyCache?: string;
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
  modelName: string;
  modelResolution?: number;
  provider?: string;
  /**
   * Update interval (in minutes)
   */
  interval: number;
  intervalPremium?: number;
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
   * How the data image path should be constructed
   */
  pathGenerator: string;
  /**
   * Alternative servers, where the data are loaded from
   */
  server?: string;
  metadataServer?: string;
  /**
   * Some product (f.ex. StaticProduct) doesn't have meaningful
   * information about the model and time of the next update.
   * Set this to false to hide the info where not relevant (f.ex. Info plugin)
   */
  hasRefTime: boolean;
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
  constructor(params: ProductInitParams);
  refTime(): YYYYMMDDHH | '';
  getUpdateTimes(): {
    refTime: ISODateString;
    minUpdate: Timestamp;
  } | null;
  moveTs(moveRight: boolean, isAccu?: boolean): boolean | void;
  getMinifestUrl(): string;
  loadMinifest(): Promise<http.HttpPayload<MinifestObject>>;
  loadAndGetReftime(): Promise<ISODateString | undefined>;
  open(): Promise<void | Calendar>;
  close(): void;
  /**
   * Checks if lat,lon is within bounds
   */
  pointIsInBounds<T extends LatLon>(this: this, paramsMap: T): boolean;
  boundsAreInViewport(map: L.Map): boolean;
  printLogo(): void;
  getCalendar(): Promise<Calendar>;
  protected expire(): void;
  /**
   * Since dissemination of minifests is not instant, and can last for minutes,
   * we have to double check, that incoming minifest
   * is newer than the one we have in store. If not, we keep the old one.
   *
   * @returns Incoming, or stored minifest, which is newer
   */
  protected getUpdatedMinifest(minifest: MinifestObject): Promise<MinifestObject>;
  protected setExpireTime(): void;
  /**
   * Major reason for this error is user's bad connection, which is handled
   * by standard no connection red message
   *
   * We delay 0.3 sec to test properly connection
   */
  protected showErrorMessage(err: string): void;
  protected loadAndProcessMinifest(forced?: boolean): Promise<void>;
  private checkNewMinifest;
  private isPointInsidePolygon;
  private removeLogo;
}
