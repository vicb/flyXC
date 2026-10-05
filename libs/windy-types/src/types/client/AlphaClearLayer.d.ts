import { type CustomLayerInterface, type CustomRenderMethodInput } from '@leafletGl';
/**
 * MapLibre canvas has alpha enabled, annoyingly, so the contents of the alpha channel of the backbuffer matters.
 * This layer just clears it to constant 1, to avoid weird blending issues caused by the canvas being semi-transparent
 * (happens for alpha lower than one).
 */
export declare class AlphaClearLayer implements CustomLayerInterface {
    readonly type: "custom";
    id: string;
    clearColor: [number, number, number, number];
    constructor(layerId: string, clearColor?: [number, number, number, number]);
    render(gl: WebGLRenderingContext | WebGL2RenderingContext, _options: CustomRenderMethodInput): void;
}
