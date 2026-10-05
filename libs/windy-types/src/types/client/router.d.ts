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
type RouteResult = {
    ident: PluginIdent | ExternalPluginIdent;
    params?: unknown;
};
export declare function resolveRoute(purl: string, source: 'url' | 'back-button', parsedQs?: ParsedQueryString): RouteResult | Promise<RouteResult | null> | null;
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
export declare const hideStartupWeather: boolean;
export declare const parsedOverlay: "hurricanes" | "ptype" | "fwi" | "uvindex" | "visibility" | "radar" | "satellite" | "wind" | "gust" | "gustAccu" | "turbulence" | "icing" | "rain" | "rainAccu" | "snowAccu" | "snowcover" | "thunder" | "temp" | "dewpoint" | "rh" | "deg0" | "wetbulbtemp" | "solarpower" | "clouds" | "hclouds" | "mclouds" | "lclouds" | "fog" | "cloudtop" | "cbase" | "cape" | "ccl" | "waves" | "swell1" | "swell2" | "swell3" | "wwaves" | "sst" | "currents" | "currentsTide" | "wavePower" | "aqi" | "no2" | "pm2p5" | "aod550" | "gtco3" | "tcso2" | "go3" | "cosc" | "dustsm" | "pressure" | "efiTemp" | "efiWind" | "efiRain" | "capAlerts" | "avalancheDanger" | "soilMoisture40" | "soilMoisture100" | "moistureAnom40" | "moistureAnom100" | "drought40" | "drought100" | "dfm10h" | "dfm100h" | "dfm1000h" | "heatmaps" | "topoMap";
export declare const parsedProduct: "drought" | "radar" | "satellite" | "capAlerts" | "avalancheDanger" | "topoMap" | "mblue" | "gfs" | "ecmwf" | "ecmwfAnalysis" | "ecmwfWaves" | "gfsWaves" | "icon" | "cams" | "efi" | "cmems" | "fireDanger" | "activeFires" | "nems" | "iconEu" | "iconD2" | "arome" | "aromeAntilles" | "aromeFrance" | "aromeReunion" | "canHrdps" | "canRdwpsWaves" | "camsEu" | "czeAladin" | "iconEuWaves" | "hrrrAlaska" | "hrrrConus" | "bomAccess" | "bomAccessAd" | "bomAccessBn" | "bomAccessDn" | "bomAccessNq" | "bomAccessPh" | "bomAccessSy" | "bomAccessVt" | "ukv" | "jmaMsm" | "jmaCwmWaves";
export {};
