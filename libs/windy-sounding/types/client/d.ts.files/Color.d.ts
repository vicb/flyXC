import { NumValue } from '@windy/types.d';

export type RGBA = [number, number, number, number];

export type YUVA = [number, number, number, number];

export type ColorGradient = [NumValue, RGBA][];

/**
 * 'rgb(200,0,150)'
 */
export type RGBString = string;

/**
 * 'rgba(200,0,150,1)'
 */
export type RGBAString = string;

export type ColorIdent =
  | 'temp'
  | 'wind'
  | 'rh'
  | 'pressure'
  | 'cclAltitude'
  | 'altitude'
  | 'deg0'
  | 'levels'
  | 'rain'
  | 'ptype'
  | 'rainClouds'
  | 'clouds'
  | 'lclouds'
  | 'hclouds'
  | 'mclouds'
  | 'cape'
  | 'lightDensity'
  | 'cbase'
  | 'snow'
  | 'rainAccu'
  | 'waves'
  | 'currents'
  | 'currentsTide'
  | 'visibility'
  | 'gtco3'
  | 'aod550'
  | 'pm2p5'
  | 'no2'
  | 'tcso2'
  | 'go3'
  | 'cosc'
  | 'dust'
  | 'satellite'
  | 'radar'
  | 'fog'
  | 'justGray'
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
  | 'solarpower'
  | 'uvindex'
  | 'turbulence'
  | 'icing'
  | 'wetbulbtemp';

type PluginColorIdent =
  | 'airQ'
  | 'windDetail'
  | 'wavesDetail'
  | 'periodDetail'
  | 'altitudeDetail'
  | 'visibilityDetail'
  | 'dewpointSpreadDetail'
  | 'blitz'
  | 'radiation';
