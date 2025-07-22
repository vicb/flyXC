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
  | 'radarPlus'
  | 'fog'
  | 'justGray'
  | 'efiWind'
  | 'efiTemp'
  | 'efiRain'
  | 'moistureAnom40'
  | 'moistureAnom100'
  | 'drought'
  | 'soilMoisture'
  | 'fwi'
  | 'dfm10h'
  | 'solarpower'
  | 'uvindex'
  | 'turbulence'
  | 'icing'
  | 'dewpoint'
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

// pressureIsolines color is dynamically created in @plugins/isolines
export type AnyColorIdent = ColorIdent | PluginColorIdent | 'pressureIsolines' | 'temporary' | 'direction';

export interface UserColor {
  id: AnyColorIdent;
  gradient: ColorGradient;
}
