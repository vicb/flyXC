import { IDB } from '@windy/IDB';
import type { MarkedNotams } from '@plugins/airport/airport';
import type { AnyColorIdent, UserColor } from '@windy/Color';
import type { AlertRequest, StoredAlert } from '@windy/alerts';
import type { Fav, FavFragment } from '@windy/favs.d';
import type { CapAlertSlided, InstalledExternalPluginConfig } from '@windy/interfaces';
import type { PromoInfoObject } from '@windy/promo';
/** Db of stored user favourites */
export declare const userFavsIdb: IDB<string, Fav, FavFragment>;
export declare const searchRecentsIdb: IDB<string, (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "airport";
    icao: string;
    iata?: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "heliport";
    icao: string;
    iata?: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "station";
    stationId: `airq-${string}` | `ad-${string}` | `wmo-${string}` | `madis-${string}` | `buoy-${string}` | `dbuoy-${string}` | `pws-${string}` | `ship-${string}`;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "webcam";
    webcamId: number;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "radiosonde";
    id: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: import("@plugins/search/search").StandardSearchType;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & {
    type: "windy-overlay";
    ident: "visibility" | "go3" | "no2" | "pm2p5" | "radar" | "satellite" | "wind" | "gust" | "gustAccu" | "turbulence" | "icing" | "rain" | "rainAccu" | "snowAccu" | "snowcover" | "ptype" | "thunder" | "temp" | "dewpoint" | "rh" | "deg0" | "wetbulbtemp" | "solarpower" | "uvindex" | "clouds" | "hclouds" | "mclouds" | "lclouds" | "fog" | "cloudtop" | "cbase" | "cape" | "ccl" | "waves" | "swell1" | "swell2" | "swell3" | "wwaves" | "sst" | "currents" | "currentsTide" | "wavePower" | "aqi" | "aod550" | "gtco3" | "tcso2" | "cosc" | "dustsm" | "pressure" | "efiTemp" | "efiWind" | "efiRain" | "capAlerts" | "avalancheDanger" | "soilMoisture40" | "soilMoisture100" | "moistureAnom40" | "moistureAnom100" | "drought40" | "drought100" | "fwi" | "dfm10h" | "dfm100h" | "dfm1000h" | "heatmaps" | "topoMap" | "hurricanes";
    thumbnailUrl: string;
    noValidLocation: true;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & {
    type: "windy-poi";
    ident: "cams" | "wind" | "temp" | "favs" | "cities" | "stations" | "precip" | "metars" | "pgspots" | "kitespots" | "surfspots" | "tide" | "firespots" | "airq" | "radiosonde" | "empty";
    poiIcon: import("../../types/iconfont").Iconfont;
    noValidLocation: true;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & {
    type: "hurricane";
    strength: StormStrength;
    stormId: string;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & {
    type: "route";
    fromTo: [import("@plugins/search/search").AirportSearchResult, import("@plugins/search/search").AirportSearchResult];
    distance: number;
}) | (import("@plugins/search/search").SearchRecentItem & import("@windy/interfaces").LatLon & {
    title: string;
    cc?: import("@windy/types").ISOCountryCode | "xx";
} & {
    type: "fav";
} & {
    id: string;
    pin2top?: number;
    pin2homepage?: number;
    updated: number;
} & import("@plugins/search/search").CountryAndRegionInformation & {
    noValidLocation?: false;
    type: "fav";
}), (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "airport";
    icao: string;
    iata?: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "heliport";
    icao: string;
    iata?: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "station";
    stationId: `airq-${string}` | `ad-${string}` | `wmo-${string}` | `madis-${string}` | `buoy-${string}` | `dbuoy-${string}` | `pws-${string}` | `ship-${string}`;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "webcam";
    webcamId: number;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: "radiosonde";
    id: string;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & import("@plugins/search/search").CountryAndRegionInformation & {
    type: import("@plugins/search/search").StandardSearchType;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & {
    type: "windy-overlay";
    ident: "visibility" | "go3" | "no2" | "pm2p5" | "radar" | "satellite" | "wind" | "gust" | "gustAccu" | "turbulence" | "icing" | "rain" | "rainAccu" | "snowAccu" | "snowcover" | "ptype" | "thunder" | "temp" | "dewpoint" | "rh" | "deg0" | "wetbulbtemp" | "solarpower" | "uvindex" | "clouds" | "hclouds" | "mclouds" | "lclouds" | "fog" | "cloudtop" | "cbase" | "cape" | "ccl" | "waves" | "swell1" | "swell2" | "swell3" | "wwaves" | "sst" | "currents" | "currentsTide" | "wavePower" | "aqi" | "aod550" | "gtco3" | "tcso2" | "cosc" | "dustsm" | "pressure" | "efiTemp" | "efiWind" | "efiRain" | "capAlerts" | "avalancheDanger" | "soilMoisture40" | "soilMoisture100" | "moistureAnom40" | "moistureAnom100" | "drought40" | "drought100" | "fwi" | "dfm10h" | "dfm100h" | "dfm1000h" | "heatmaps" | "topoMap" | "hurricanes";
    thumbnailUrl: string;
    noValidLocation: true;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & {
    type: "windy-poi";
    ident: "cams" | "wind" | "temp" | "favs" | "cities" | "stations" | "precip" | "metars" | "pgspots" | "kitespots" | "surfspots" | "tide" | "firespots" | "airq" | "radiosonde" | "empty";
    poiIcon: import("../../types/iconfont").Iconfont;
    noValidLocation: true;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & {
    type: "hurricane";
    strength: StormStrength;
    stormId: string;
    addShakyClass: true;
    doNotSave: true;
}) | (import("@plugins/search/search").SearchRecentItem & import("@plugins/search/search").RequiredSearchItemProperties & import("@windy/interfaces").LatLon & {
    type: "route";
    fromTo: [import("@plugins/search/search").AirportSearchResult, import("@plugins/search/search").AirportSearchResult];
    distance: number;
}) | (import("@plugins/search/search").SearchRecentItem & import("@windy/interfaces").LatLon & {
    title: string;
    cc?: import("@windy/types").ISOCountryCode | "xx";
} & {
    type: "fav";
} & {
    id: string;
    pin2top?: number;
    pin2homepage?: number;
    updated: number;
} & import("@plugins/search/search").CountryAndRegionInformation & {
    noValidLocation?: false;
    type: "fav";
})>;
/** Db of stored user alerts */
export declare const userAlertsIdb: IDB<string, StoredAlert, AlertRequest>;
/** Db of stored notams marked as read */
export declare const markedNotamsIdb: IDB<`${string}_${string}/${string}`, MarkedNotams, MarkedNotams>;
/** Upvoted articles */
export declare const upvotedArticlesIdb: IDB<string | number, true, true>;
/** Upvoted comments, keyed by articleId */
export declare const upvotedCommentsIdb: IDB<number, string[], string[]>;
/** Seen promos */
export declare const seenPromosIdb: IDB<string, PromoInfoObject, PromoInfoObject>;
/** Custom user colors  */
export declare const customColorsIdb: IDB<AnyColorIdent, UserColor, UserColor>;
/** Cap alerts that were slided from left to right on startup screen */
export declare const slidedCapAlertsIdb: IDB<string, CapAlertSlided, CapAlertSlided>;
/** Log of pages & events that happened on this device */
export declare const logIdb: IDB<`version/${string}` | `path/${string}` | `airport/${string}` | `station/${string}` | `pois/${string}` | `subscription/${string}` | `garmin/${string}` | `onboarding/${string}` | `articles/${string}` | `plugin/${string}` | `overlay/${string}` | `level/${string}` | `acRange/${string}` | `levelsRange/${string}` | `isolinesType/${string}` | `isolinesOn/${string}` | `product/${string}` | `startup/${string}` | `404/${string}` | `promo/${string}` | `appRating/${string}` | `appOpening/${string}` | `detail2/${string}` | `appsflyer/${string}` | `weather/${string}` | `events/${string}` | `locationPermissionPopup/${string}` | `widgetPromo/${string}` | `storyEvent/${string}` | `routePlanner/${string}` | `garminEdge/${string}`, number, number>;
/** Log of locations, that user uses on this device */
export declare const popularLocationsIdb: IDB<string, number, number>;
/** Installed external plugins  */
export declare const installedPluginsIdb: IDB<string, InstalledExternalPluginConfig, InstalledExternalPluginConfig>;
export declare const clearIndexedDB: () => Promise<void>;
