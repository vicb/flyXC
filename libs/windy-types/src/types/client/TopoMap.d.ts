import { Renderer } from '@windy/Renderer';
import { RasterLayerCustom } from '@windy/RasterLayerCustom';
import type { Renderers } from '@windy/Renderer';
export declare class TopoMap extends Renderer {
    baseLayer: RasterLayerCustom | null;
    open(): Promise<void>;
    close(rqrdRenderers: Renderers[]): void;
    addOrUpdateBaseLayer(): void;
    removeBaseLayer(): void;
}
