import { RasterLayerCustom } from '@windy/RasterLayerCustom';
export type LandLayerType = 'land-mask' | 'sea-mask' | 'colored';
export declare function createLandLayer(tileSource: string, layerType: LandLayerType): RasterLayerCustom;
