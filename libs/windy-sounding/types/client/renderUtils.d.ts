/**
 * Shared rendering utilities (and also event emitter for rendering purposes)
 */
import { Evented } from '@windy/Evented';
import type { Color } from '@windy/Color';
import type { DataQuality } from '@windy/Product';
import type { TileParams } from '@windy/Renderer';
import type { TilePoint, FullRenderParameters, WeatherParameters } from '@windy/interfaces.d';
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
 * Returns coordinates and details of data tile based on map tile or null if out of bounds
 */
export declare const whichTile: (tilePoint: TilePoint, params: FullRenderParameters) => TileParams | null;
/**
 * Test that values in blue channel are bigger than X,
 * which means transparency for this point in JPG data tile
 */
export declare const testJPGtransparency: (source: Uint8ClampedArray, sourceIndex: number) => boolean;
/**
 * Test transparency of PNGoverlay
 */
export declare const testPNGtransparency: (source: Uint8ClampedArray, sourceIndex: number) => boolean;
/**
 * Object containing 3D tables with precalculated
 * interpolation wights
 *
 * @description
 *
 * key is trans number (1,2,4,8...)
 * ```
 * wTables = {
 *   '2': [ p00w1, p00w2, p00w3, p00w4,    p01w1, p01w2, p01w3, p01w4,
 *          p10w1, p10w2, p10w3, p10w4,    p00w1, p00w2, p00w3, p00w4   ]
 *
 *    }
 * ```
 */
export declare const wTables: Record<number, Uint16Array>;
/**
 * get wTable (and generate it if not done yet)
 */
export declare const getWTable: (trans: number) => Uint16Array | null;
export type ColorizingFun = (x: number, y: number, scalar: number) => void;
/**
 * Create function for colorizing x,y, point in step x step area
 * Allowed values of step are 1,2
 * Colorizes only for 256x256 tiles
 */
export declare const createFillFun: (dest: Uint8ClampedArray, step: 1 | 2, col: Color) => ColorizingFun;
/**
 * Interpolates to nearest discreet value either by using interpolation table
 * or a,b,c,d coefficients
 */
export declare const interpolateNearest: (
  w: number[] | null,
  wIndex: number,
  G00: number,
  G01: number,
  G10: number,
  G11: number,
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
/**
 * Creates RenderingParameters
 */
export declare const createFullRenderingParams: (
  layerIdent: Layers,
  weatherParams: WeatherParameters,
  timestamp: Timestamp,
) => Promise<FullRenderParameters>;
export {};
