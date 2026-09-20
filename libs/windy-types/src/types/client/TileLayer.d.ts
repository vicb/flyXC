import { Renderer } from '@windy/Renderer';
import type { FullRenderParameters, WeatherParameters } from '@windy/interfaces';
import type { RendererInitParams, Renderers } from '@windy/Renderer';
import type { Layers } from '@windy/Layer';
import type { Timestamp } from '@windy/types';
export declare class TileLayer extends Renderer {
    private readonly _layerId;
    private _lastUsedMapParams;
    private _initializeCallbackSet;
    constructor(params: RendererInitParams);
    onopen(params: FullRenderParameters): void;
    close(rqrdRenderers: Renderers[]): void;
    redraw(): void;
    paramsChanged(layerIdent: Layers, weatherParams: WeatherParameters, timestamp: Timestamp): Promise<void>;
    private _ensureMapAndSetParams;
    private _initialize;
}
