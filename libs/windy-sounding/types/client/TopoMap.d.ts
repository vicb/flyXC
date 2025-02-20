import { Renderer } from '@windy/Renderer';
import type { FullRenderParameters } from '@windy/Layer.d';
import type { Renderers } from '@windy/Renderer.d';
export declare class TopoMap extends Renderer {
  baseLayer: L.GridLayer | null;
  open(_params: FullRenderParameters): Promise<void>;
  close(rqrdRenderers: Renderers[]): void;
  addOrUpdateBaseLayer(): void;
  removeBaseLayer(): void;
}
