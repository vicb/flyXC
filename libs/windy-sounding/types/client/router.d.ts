import { type ParsedQueryString } from '../utils/queryString';
import type { PluginIdent } from '@windy/Plugin';
import type { Coords, PickerCoords } from '@windy/interfaces.d';
import type { Overlays, Products } from '@windy/rootScope.d';
import type { ExternalPluginIdent } from '@windy/types';
export type ParsedStartupValues = {
  sharedCoords: Coords | null;
  pickerCoords: PickerCoords | null;
  overlay: Overlays | null;
  product: Products | null;
};
/**
 * Parse URL to plugin and its parameters (if any)
 *
 * @returns true if some of the plugins was matched, false otherwise
 */
export declare function resolveRoute(
  purl: string,
  source: 'url' | 'back-button',
  parsedQs?: ParsedQueryString,
): ExternalPluginIdent | PluginIdent | void;
/**
 * Parse search part of the URL
 * eg: https://www.windy.com/?overlay,level,lat,lon,zoom,marker
 * lat,lon,zoom are obligatory and must go always together
 * All other params are optional and can be in any order
 * WARNING: This method has thousands of side effects!!
 *
 * @param searchQuery Search part of the URL, eg: lat,lon,zoom,marker
 * @returns Coordinates from the URL (if any) and coordinates of the picker (if any)
 */
export declare function parseSearch(searchQuery: string | undefined): ParsedStartupValues | undefined;
/**
 * Parsed items from URL
 */
export declare const sharedCoords: Coords;
export declare const parsedOverlay:
  | 'visibility'
  | 'radar'
  | 'satellite'
  | 'radarPlus'
  | 'wind'
  | 'gust'
  | 'gustAccu'
  | 'turbulence'
  | 'icing'
  | 'rain'
  | 'rainAccu'
  | 'snowAccu'
  | 'snowcover'
  | 'ptype'
  | 'thunder'
  | 'temp'
  | 'dewpoint'
  | 'rh'
  | 'deg0'
  | 'wetbulbtemp'
  | 'solarpower'
  | 'uvindex'
  | 'clouds'
  | 'hclouds'
  | 'mclouds'
  | 'lclouds'
  | 'fog'
  | 'cloudtop'
  | 'cbase'
  | 'cape'
  | 'ccl'
  | 'waves'
  | 'swell1'
  | 'swell2'
  | 'swell3'
  | 'wwaves'
  | 'sst'
  | 'currents'
  | 'currentsTide'
  | 'no2'
  | 'pm2p5'
  | 'aod550'
  | 'gtco3'
  | 'tcso2'
  | 'go3'
  | 'cosc'
  | 'dustsm'
  | 'pressure'
  | 'efiTemp'
  | 'efiWind'
  | 'efiRain'
  | 'capAlerts'
  | 'soilMoisture40'
  | 'soilMoisture100'
  | 'moistureAnom40'
  | 'moistureAnom100'
  | 'drought40'
  | 'drought100'
  | 'fwi'
  | 'dfm10h'
  | 'heatmaps'
  | 'topoMap'
  | 'hurricanes';
export declare const parsedProduct:
  | 'icon'
  | 'radar'
  | 'satellite'
  | 'radarPlus'
  | 'capAlerts'
  | 'topoMap'
  | 'nems'
  | 'namConus'
  | 'namHawaii'
  | 'namAlaska'
  | 'iconEu'
  | 'iconD2'
  | 'arome'
  | 'aromeAntilles'
  | 'aromeFrance'
  | 'aromeReunion'
  | 'canHrdps'
  | 'canRdwpsWaves'
  | 'camsEu'
  | 'czeAladin'
  | 'iconEuWaves'
  | 'hrrrAlaska'
  | 'hrrrConus'
  | 'bomAccess'
  | 'bomAccessAd'
  | 'bomAccessBn'
  | 'bomAccessDn'
  | 'bomAccessNq'
  | 'bomAccessPh'
  | 'bomAccessSy'
  | 'bomAccessVt'
  | 'ukv'
  | 'jmaMsm'
  | 'jmaCwmWaves'
  | 'gfs'
  | 'ecmwf'
  | 'ecmwfAnalysis'
  | 'ecmwfWaves'
  | 'gfsWaves'
  | 'cams'
  | 'efi'
  | 'cmems'
  | 'drought'
  | 'fireDanger'
  | 'activeFires'
  | 'mblue';
