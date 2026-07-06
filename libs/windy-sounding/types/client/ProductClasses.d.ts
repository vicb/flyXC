import { Calendar } from '@windy/Calendar';
import { Product } from '@windy/Product';
import type { ProductInitParams } from '@windy/Product';
import type { MinifestObject } from '@windy/Calendar';
import type { Overlays } from '@windy/rootScope.d';
export declare class EcmwfProduct extends Product {
  calendar: Calendar;
  constructor(params: Partial<ProductInitParams>);
}
export declare class EcmwfForecastProduct extends EcmwfProduct {
  /**
   * Main goal for custom loadMInifest method is to speed up loading of default minifest little bit.
   * Default minifests are loaded ASAP in inlined JS code inside (index|mobile).html so they are
   * available faster, then when loaded after parsing all the rest of JS code.
   *
   * After any change in the code, check in DevTools, that this mechanism actually works.
   */
  loadMinifest(): Promise<MinifestObject>;
}
export declare class HrrrProducts extends Product {
  constructor(params: Partial<ProductInitParams>);
}
export declare const iconOverlays: Overlays[];
export declare class IconProducts extends Product {
  constructor(params: Pick<ProductInitParams, 'modelName'> & Partial<ProductInitParams>);
}
export type SatelliteProductInitParams = Pick<SatAndRadarPlusProduct, 'urlSuff' | 'urlSuffFlow'> & ProductInitParams;
export declare class SatAndRadarPlusProduct extends Product {
  urlSuff: string;
  urlSuffFlow: string;
  constructor(params: SatelliteProductInitParams);
}
/**
 * Auxiliary product with fake calendar required for rendering of isolines on top of overlays, that do not have calendar nor load minifest
 *  - provides timestamp array with single timestamp pair equal to the current time
 */
export declare class FakeCalendarProduct extends Product {
  loadMinifest(): Promise<MinifestObject>;
}
export declare class NamProducts extends Product {
  constructor(params: Partial<ProductInitParams>);
}
export declare class AccessProduct extends Product {
  constructor(params: Partial<ProductInitParams>);
}
export declare class AccessCProduct extends AccessProduct {
  constructor(params: Partial<ProductInitParams>);
}
export declare class AromeProduct extends Product {
  constructor(params: Partial<ProductInitParams>);
}
