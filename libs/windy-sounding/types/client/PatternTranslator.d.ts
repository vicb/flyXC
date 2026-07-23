import { Point } from "@leafletGl";
/**
 * This class computes pattern translation and opacity based on map movement.
 * Patterns are translated so that they move along with the map, unless zooming.
 * During zoom, patterns gradually fade out over a fraction of a second,
 * and fade back in once zooming is done.
 */
export declare class PatternTranslator {
    private _lastCenter?;
    private _lastZoom;
    private _lastTranslation;
    private _opacity;
    private _lastZooming;
    private _zooming;
    private _lastUpdateTime;
    get translation(): Point;
    get opacity(): number;
    init(): void;
    update(textureSize: {
        x: number;
        y: number;
    }): void;
    destroy(): void;
    private _zoomStart;
    private _zoomEnd;
}
