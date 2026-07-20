import type { PluginIdent } from '@windy/Plugin';
import type { Coords, PickerCoords } from '@windy/interfaces.d';
import type { Overlays, Products } from '@windy/rootScope.d';
import type { ExternalPluginIdent, ParsedQueryString } from '@windy/types';
export type ParsedStartupValues = {
    sharedCoords: Coords | null;
    pickerCoords: PickerCoords | null;
    overlay: Overlays | null;
    product: Products | null;
    hideStartupWeather?: boolean;
};
/**
 * Parse URL to plugin and its parameters (if any)
 *
 * While the method is async, for internal plugins it is not awaited, and
 * only external plugins are awaited.
 *
 * @returns ident of matched plugin for purpose of stats
 */
export declare function resolveRoute(purl: string, source: 'url' | 'back-button', parsedQs?: ParsedQueryString): Promise<PluginIdent | ExternalPluginIdent | void>;
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
/**
 * The app was launched by widget or notification, so we should hide
 * the startup weather
 */
export declare const hideStartupWeather: boolean;
export declare const parsedOverlay: "pressure" | "visibility" | "radar" | "satellite" | "wind" | "gust" | "gustAccu" | "turbulence" | "icing" | "rain" | "rainAccu" | "snowAccu" | "snowcover" | "ptype" | "thunder" | "temp" | "dewpoint" | "rh" | "deg0" | "wetbulbtemp" | "solarpower" | "uvindex" | "clouds" | "hclouds" | "mclouds" | "lclouds" | "fog" | "cloudtop" | "cbase" | "cape" | "ccl" | "waves" | "swell1" | "swell2" | "swell3" | "wwaves" | "sst" | "currents" | "currentsTide" | "wavePower" | "aqi" | "no2" | "pm2p5" | "aod550" | "gtco3" | "tcso2" | "go3" | "cosc" | "dustsm" | "efiTemp" | "efiWind" | "efiRain" | "capAlerts" | "soilMoisture40" | "soilMoisture100" | "moistureAnom40" | "moistureAnom100" | "drought40" | "drought100" | "fwi" | "dfm10h" | "heatmaps" | "topoMap" | "hurricanes" | "radarPlus";
export declare const parsedProduct: "icon" | "radar" | "satellite" | "capAlerts" | "topoMap" | "nems" | "namConus" | "namHawaii" | "namAlaska" | "iconEu" | "iconD2" | "arome" | "aromeAntilles" | "aromeFrance" | "aromeReunion" | "canHrdps" | "canRdwpsWaves" | "camsEu" | "czeAladin" | "iconEuWaves" | "hrrrAlaska" | "hrrrConus" | "bomAccess" | "bomAccessAd" | "bomAccessBn" | "bomAccessDn" | "bomAccessNq" | "bomAccessPh" | "bomAccessSy" | "bomAccessVt" | "ukv" | "jmaMsm" | "jmaCwmWaves" | "gfs" | "ecmwf" | "ecmwfAnalysis" | "ecmwfWaves" | "gfsWaves" | "cams" | "efi" | "cmems" | "drought" | "fireDanger" | "activeFires" | "mblue";
