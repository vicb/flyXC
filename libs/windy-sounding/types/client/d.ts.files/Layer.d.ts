import { NumberedMetric, PrecipMetric, PtypeMetric, UVIndexMetric } from '@windy/MetricClasses';
import { DataQuality, FileSuffix } from '@windy/Product.d';
import { WeatherParameters } from '@windy/interfaces.d';
import { Levels, Overlays } from '@windy/rootScope.d';
import { NumValue, Path } from '@windy/types.d';

// TODO: Move to particles.d.ts later
export type ParticlesIdent = 'wind' | 'waves' | 'currents';

// TODO: Move to Patternator.d.ts later on
export type Patterntype = 'cclPattern' | 'rainPattern' | 'ptypePattern';

export type TransformFunction = (x: NumValue) => NumValue;

export type RenderChannels = 'R' | 'RG' | 'B';

/**
 * All available layers and their metric value type
 */
export interface LayerMetricType {
  capAlerts: undefined;
  pressureIsolines: undefined;
  ghIsolines: undefined;
  tempIsolines: undefined;
  deg0Isolines: undefined;
  windParticles: undefined;
  ecmwfWindParticles: undefined;
  ecmwfWindParticles150h: undefined;
  ecmwfWindParticles500h: undefined;
  ecmwfWindParticles600h: undefined;
  waveParticles: undefined;
  currentParticles: undefined;
  currentsTideParticles: undefined;
  wind: NumberedMetric;
  temp: NumberedMetric;
  wetbulbtemp: NumberedMetric;
  solarpower: NumberedMetric;
  uvindex: UVIndexMetric;
  dewpoint: NumberedMetric;
  gust: NumberedMetric;
  gustAccu: NumberedMetric;
  rh: NumberedMetric;
  pressure: NumberedMetric;
  ccl: NumberedMetric;
  rain: PrecipMetric;
  ptype: PtypeMetric;
  thunder: NumberedMetric;
  clouds: NumberedMetric;
  lclouds: NumberedMetric;
  mclouds: NumberedMetric;
  hclouds: NumberedMetric;
  cape: NumberedMetric;
  cbase: NumberedMetric;
  fog: NumberedMetric;
  snowAccu: NumberedMetric;
  rainAccu: NumberedMetric;
  waves: NumberedMetric;
  wwaves: NumberedMetric;
  swell1: NumberedMetric;
  swell2: NumberedMetric;
  swell3: NumberedMetric;
  swell: NumberedMetric;
  currents: NumberedMetric;
  currentsTide: NumberedMetric;
  sst: NumberedMetric;
  visibility: NumberedMetric;
  snowcover: NumberedMetric;
  cloudtop: NumberedMetric;
  deg0: NumberedMetric;
  cosc: NumberedMetric;
  dustsm: NumberedMetric;
  radar: NumberedMetric;
  satellite: NumberedMetric;
  gtco3: NumberedMetric;
  pm2p5: NumberedMetric;
  no2: NumberedMetric;
  aod550: NumberedMetric;
  tcso2: NumberedMetric;
  go3: NumberedMetric;
  gh: NumberedMetric;
  efiWind: NumberedMetric;
  efiTemp: NumberedMetric;
  efiRain: NumberedMetric;
  moistureAnom40: PrecipMetric;
  moistureAnom100: PrecipMetric;
  drought40: NumberedMetric;
  drought100: NumberedMetric;
  soilMoisture40: NumberedMetric;
  soilMoisture100: NumberedMetric;
  fwi: NumberedMetric;
  dfm10h: NumberedMetric;
  turbulence: NumberedMetric;
  icing: NumberedMetric;
}

/**
 * All layers available
 */
export type Layers = keyof LayerMetricType;

/**
 * These properties are passed directly to renderer by enhancing returned params
 */
interface RenderParams {
  /**
   * Which channels contain tile rendering data
   */
  renderFrom?: RenderChannels;

  /**
   * Not confirmed: Display map as a sea, meaning the sea layers are below surface layers
   */
  sea?: boolean;

  /**
   * Display map as a land, meaning the sea area is hidden with mask
   */
  landOnly?: boolean;

  /**
   * Identifier of particle type
   */
  particlesIdent?: ParticlesIdent;

  /**
   * Have no clue what this is
   */
  isMultiColor?: boolean;

  /**
   * Have no clue what this is
   */
  interpolateNearestG?: boolean;

  /**
   * Name of interpolator method
   */
  interpolate?: 'interpolateOverlay' | 'interpolateWaves';

  /**
   * Used patternator
   */
  pattern?: Patterntype;
}

/**
 * Set of params required to render the layer
 */
interface FullRenderParameters extends WeatherParameters, RenderParams {
  layer: Layers;
  server: string;
  JPGtransparency?: boolean;
  PNGtransparency?: boolean;
  transformR?: TransformFunction;
  transformG?: TransformFunction;
  transformB?: TransformFunction;
  directory: string;
  filename: string | Overlays | Layers;
  fileSuffix: FileSuffix;

  /**
   * Specifi zoom of mercator data tiles in dependence of map zoom
   */
  dataQuality?: DataQuality;
  maxTileZoom?: {
    free: number;
    premium: number;
  };

  /**
   * bump data quality by 1 level for particular overlay/layer
   */
  upgradeDataQuality?: boolean;

  /**
   * Force to slect particular zoom of data tiles
   */
  dataTilesZoom?: number;

  level: Levels;
  refTime: string;
  fullPath: string;
  path: Path;
}
