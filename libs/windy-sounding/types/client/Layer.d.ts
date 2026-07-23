import type { Color } from '@windy/Color';
import type { Metric } from '@windy/Metric';
import type { DataQuality, FileSuffix } from '@windy/Product';
import type { Renderers } from '@windy/Renderer';
import type { Levels, Products } from '@windy/rootScope.d';
import type { TransformFunction } from '@windy/types';
import type { RenderParams } from '@windy/interfaces';
/**
 * All layers available
 */
export type Layers =
  | 'capAlerts'
  | 'pressureIsolines'
  | 'ghIsolines'
  | 'tempIsolines'
  | 'deg0Isolines'
  | 'windParticles'
  | 'ecmwfWindParticles'
  | 'ecmwfWindParticles150h'
  | 'ecmwfWindParticles500h'
  | 'ecmwfWindParticles600h'
  | 'waveParticles'
  | 'waveParticlesWaves'
  | 'currentParticles'
  | 'currentsTideParticles'
  | 'wind'
  | 'temp'
  | 'wetbulbtemp'
  | 'solarpower'
  | 'wavePower'
  | 'uvindex'
  | 'dewpoint'
  | 'gust'
  | 'gustAccu'
  | 'rh'
  | 'pressure'
  | 'ccl'
  | 'rain'
  | 'ptype'
  | 'thunder'
  | 'clouds'
  | 'lclouds'
  | 'mclouds'
  | 'hclouds'
  | 'cape'
  | 'cbase'
  | 'fog'
  | 'snowAccu'
  | 'rainAccu'
  | 'waves'
  | 'wwaves'
  | 'swell1'
  | 'swell2'
  | 'swell3'
  | 'swell'
  | 'currents'
  | 'currentsTide'
  | 'sst'
  | 'visibility'
  | 'snowcover'
  | 'cloudtop'
  | 'deg0'
  | 'cosc'
  | 'dustsm'
  | 'radar'
  | 'satellite'
  | 'gtco3'
  | 'pm2p5'
  | 'no2'
  | 'aod550'
  | 'tcso2'
  | 'go3'
  | 'gh'
  | 'efiWind'
  | 'efiTemp'
  | 'efiRain'
  | 'moistureAnom40'
  | 'moistureAnom100'
  | 'drought40'
  | 'drought100'
  | 'soilMoisture40'
  | 'soilMoisture100'
  | 'fwi'
  | 'dfm10h'
  | 'dfm100h'
  | 'dfm1000h'
  | 'turbulence'
  | 'icing'
  | 'topoMap'
  | 'aqi'
  | 'avalancheDanger';
export type LayerInitParams = Pick<Layer, 'ident'> & Partial<Layer>;
export declare class Layer {
  /**
   * Colors instance(s) used for this overlay
   */
  c?: Color;
  /**
   * Layer identifier (used for metric settings) since some overlays are just pointers to
   * other overlays, identifier can be same for more overlays.
   */
  ident: Layers;
  /**
   * Standard renderer ident
   */
  renderer: Renderers;
  /**
   * If set replaces overlay as filename for particular file path
   */
  filename?: string;
  /**
   * If defined overwrites data precision quality of product
   */
  dataQuality?: DataQuality;
  /**
   * If set overrides file suffix of product
   */
  fileSuffix?: FileSuffix;
  /**
   * Blue channel defines transparency
   */
  JPGtransparency?: boolean;
  /**
   * PNG file with defined transparency
   */
  PNGtransparency?: boolean;
  /**
   * Overrides product's maxTileZoom
   */
  maxTileZoom?: {
    free: number;
    premium: number;
  };
  /**
   * Properties passed directly to renderer
   */
  renderParams?: RenderParams;
  /**
   * Overrides param's product
   */
  product?: Products;
  /**
   * Overrides products or params levels
   */
  levels?: Levels[];
  /**
   * Optional query string that enhances query string
   */
  query?: string;
  /**
   * webGL transformation
   */
  wTransformR?: number | 'rainLog';
  /**
   * Metrics to use in color settings
   * If users opts to change colors of this layer, use this metrics
   */
  cm?: Metric;
  /**
   * Method to transfrom value in R channel
   */
  transformR?: TransformFunction;
  /**
   * Method to transfrom value in G channel
   */
  transformG?: TransformFunction;
  /**
   * Method to transfrom value in B channel
   */
  transformB?: TransformFunction;
  constructor(params: LayerInitParams);
  /**
   * Just calls Color's getColor() method
   */
  getColor(): ReturnType<Color['getColor']> | undefined;
}
