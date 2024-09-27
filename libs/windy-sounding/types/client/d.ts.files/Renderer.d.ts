import { TransformFunction } from '@windy/Layer.d';
import { TilePoint } from '@windy/interfaces.d';

export type Renderers =
  | 'tileLayer'
  | 'radar'
  | 'satellite'
  | 'capAlerts'
  | 'isolines'
  | 'particles'
  | 'accumulations'
  | 'daySwitcher'
  | 'noUserControl';

export interface TileParams extends TilePoint {
  url: string;
  intX: number;
  intY: number;
  trans: number;
  transformR: TransformFunction | null;
  transformG: TransformFunction | null;
  transformB: TransformFunction | null;
}
