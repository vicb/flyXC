import { Product } from '@windy/Product';
import type { Overlays } from '@windy/rootScope.d';
import type { ProductInitParams } from './Product';
export declare const iconOverlays: Overlays[];
export declare class IconProducts extends Product {
  constructor(params: Pick<ProductInitParams, 'modelName'> & Partial<ProductInitParams>);
}
