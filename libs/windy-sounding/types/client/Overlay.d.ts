import type { Layer } from '@windy/Layer';
import type { LayerMetricType, Layers } from '@windy/Layer.d';
import type { Metric } from '@windy/Metric';
import type { DirectionFunction } from '@windy/format.d';
import type { Iconfont } from '@windy/iconfont.d';
import type { Overlays } from '@windy/rootScope.d';
import type { RGBNumValues } from '@windy/interpolatorTypes';
import type { LoadedTranslations, HTMLString } from '@windy/types';
import type { RGBAString } from '@windy/Color.d';
export type UsedOverlays = Overlays | 'swell' | 'satelliteIRBT';
export type OverlayInitParams = Pick<Overlay, 'ident'> & Partial<Overlay>;
type LayerProperty<L extends Layer | undefined, P extends keyof Layer> = L extends Layer ? L[P] : undefined;
type MetricProperty<M extends Metric | undefined, P extends keyof Metric> = M extends Metric ? M[P] : undefined;
export declare class Overlay<
  I extends Overlays = Overlays,
  M extends I extends Layers ? LayerMetricType[I] : undefined = I extends Layers ? LayerMetricType[I] : undefined,
  L extends Layer<M> | undefined = I extends Layers ? Layer<M> : undefined,
> {
  /**
   * Main ident
   */
  ident: I;
  /**
   * Translation string
   */
  trans: keyof LoadedTranslations;
  /**
   * Shortened version of translation string
   *
   * Used only on fav overlays in desktop. It is worth to
   * fill only for overlays with long names, that are used
   * as a default fav overlay in desktop.
   */
  transShort?: keyof LoadedTranslations;
  /**
   * Overlay has more levels
   */
  hasMoreLevels?: boolean;
  /**
   * Icon used in menus and such
   */
  icon: Iconfont;
  /**
   * Layers used
   */
  layers: I extends Layers ? [...Layers[], I] | [I, ...Layers[]] : undefined;
  /**
   * Is the overlay supported in globe mode. Default: false
   */
  globeNotSupported: boolean;
  /**
   * Show interpolated weather value over cities, when user switches to POI cities
   * TODO: Unify property with hideWxLabels
   */
  poiInCities: boolean;
  /**
   * Hide interpolated weather value over cities, when user switches to POI cities
   */
  hideWxLabels?: boolean;
  /**
   * Hide elevation in the desktop picker
   */
  hidePickerElevation?: boolean;
  /**
   * Eg. in day-switcher we need as short name as possible
   */
  shortname?: string;
  /**
   * Eg. in overlays gallery it is needed to have more specific name of the layer
   */
  fullname?: string;
  /**
   * When overlay represents group of other layers, this can be used to get the whole group menu icon independently from the layer
   */
  menuIcon?: Iconfont;
  /**
   * When overlay represents group of other layers, this can be used to name the whole group in menu independently from the layer
   */
  menuTrans?: keyof LoadedTranslations;
  /**
   * Hide overlay from listing in all the menus
   */
  partOf?: Overlays;
  /**
   * Hides particle on/off switch in GUI (so far used only in desktop GUI)
   */
  hideParticles?: boolean;
  /**
   * Given overlay display accumulation
   */
  isAccu?: boolean;
  /**
   * allwaysOn
   */
  allwaysOn?: boolean;
  /**
   * Programatically injected properties from particulat Metric instance
   */
  m: M;
  convertValue: MetricProperty<M, 'convertValue'>;
  convertNumber: MetricProperty<M, 'convertNumber'>;
  setMetric: MetricProperty<M, 'setMetric'>;
  cycleMetric: MetricProperty<M, 'cycleMetric'>;
  listMetrics: MetricProperty<M, 'listMetrics'>;
  /**
   * Programatically injected properties from particulat Layer instance
   */
  c: LayerProperty<L, 'c'>;
  l: LayerProperty<L, 'l'>;
  cm: LayerProperty<L, 'cm'>;
  /**
   * Do not display this overlay in URL
   */
  hideFromURL?: boolean;
  /**
   * Optional promo badge to be displayed in GUI
   */
  promoBadge?: string;
  promoBadgeColor?: RGBAString;
  /**
   * Optional menu image thumbnail
   */
  menuImage?: string;
  constructor(params: OverlayInitParams);
  /**
   * When clicking on overlay in menu, do the following action (ready to be overloaded)
   */
  onClick(): void;
  /**
   * Render's overlay's legend inside  el
   */
  paintLegend(el: HTMLDivElement): void;
  /**
   * Return translated description of overlay
   *
   * @param short If true, return shortened version of description if avail
   */
  getName(short?: boolean): string;
  /**
   * Return URL of image for overlay
   */
  getMenuImagePath(): string;
  /**
   * Get menu title
   *
   * @param short If true, return shortened version of description if avail
   */
  getMenuName(short?: boolean): string;
  /**
   * Return ident of menu item (usualy `ident` but some inner overlays has `partOf` and are not directly in menu)
   */
  getMenuIdent(): Overlays;
  /**
   * Custom onopen methods, currently unused
   */
  onopen?(): void;
  onclose?(): void;
  /**
   * Create part of inner text of picker
   * @param values Interpolated values
   */
  createPickerHTML(values: RGBNumValues, _directionFormattingFunction: DirectionFunction): HTMLString;
  /**
   * Just proxy to the Metric's metric property
   */
  get metric(): '' | import('./Metric').MetricItem;
  protected initProperties(): void;
}
export {};
