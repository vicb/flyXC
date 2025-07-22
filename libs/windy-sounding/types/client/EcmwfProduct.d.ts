import { Calendar } from '@windy/Calendar';
import { Product } from '@windy/Product';
import type { ProductInitParams } from '@windy/Product';
export declare class EcmwfProduct extends Product {
  calendar: Calendar;
  constructor(params: Partial<ProductInitParams>);
}
