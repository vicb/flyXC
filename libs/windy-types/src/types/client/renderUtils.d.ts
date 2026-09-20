/**
 * Shared rendering utilities (and also event emitter for rendering purposes)
 */
import { Evented } from '@windy/Evented';
import type { DataQuality } from '@windy/Product';
import type { FullRenderParameters, WeatherParameters } from '@windy/interfaces.d';
interface Events {
    rendered: ['particles' | 'isolines' | 'map' | 'radar' | 'satellite' | 'tileLayer'];
    glParticlesFailed: [];
    toggleSeaMask: [boolean];
    toggleLandMask: [boolean];
    toggleLandSeaMaskColored: [boolean];
    updateStateChange: ['move' | 'time'];
    tileLayerRendererInitialized: [];
    contextLost: [];
    contextRestored: [];
}
export declare const emitter: Evented<Events>;
import type { Timestamp } from '@windy/types';
import type { Layers } from '@windy/Layer';
/**
 * Zoom2zoom transformation table
 *
 * Maximal zoom levels:
 *
 * GFS 0, 1, 2
 * ECMWF 0, 1, 2, 3
 * NAM/MB EUROPE 0, 1, 2, 3, 4, 5
 *
 * WARNING: Minimal dataZoom for map zooms 10,11 is 3 since
 * maximal amount of data -> pixel transition ratio is 256 !!!
 *
 * NOTE: particles don't work for zoom 0 on -180/180 border ("low" map zooms 3 & 4 changed to data zoom 1)
 */
export declare const zoom2zoom: Record<DataQuality, number[]>;
/**
 * Return tiles width (amount of tiles) based on zoom level
 */
export declare const tileW: (zoom: number) => number;
/**
 * Return transformation ratio based on map zoom and data zoom
 */
export declare const getTrans: (mapZoom: number, dZoom: number) => number;
/**
 * Return data zoom based on params
 * BUG: Sometime we receive not valid dataQuality
 * if upgradeDataQuality flag is set upgrade to better quality
 */
export declare const getDataZoom: (params: FullRenderParameters, tileZoom: number) => number;
/**
 * Creates RenderingParameters
 */
export declare const createFullRenderingParams: (layerIdent: Layers, weatherParams: WeatherParameters, timestamp: Timestamp) => Promise<FullRenderParameters>;
export {};
