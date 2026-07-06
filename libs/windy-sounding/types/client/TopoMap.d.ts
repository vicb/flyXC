import { Renderer } from '@windy/Renderer';
import { TileLayer } from '@leafletGl';
import type { Renderers } from '@windy/Renderer';
export declare class TopoMap extends Renderer {
  baseLayer: TileLayer | null;
  open(): Promise<void>;
  close(rqrdRenderers: Renderers[]): void;
  addOrUpdateBaseLayer(): void;
  removeBaseLayer(): void;
}
