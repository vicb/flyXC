import { TileLayer } from '@leafletGl';
export type LandLayerType = 'land-mask' | 'sea-mask' | 'colored';
export declare function createLandLayer(tileSource: string, layerType: LandLayerType): TileLayer;
