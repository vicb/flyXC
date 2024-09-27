import type { Iconfont } from './d.ts.files/iconfont';
import type { Isolines, Pois } from './d.ts.files/rootScope';
import type { LoadedTranslations } from './d.ts.files/trans';
/**
 * Version of Windy.com client (as taken from package.json)
 * @ignore
 */
export declare const version: string;
/**
 * Target
 * @ignore
 */
export declare const target: 'mobile' | 'index' | 'lib' | 'embed2';
/**
 * Platform
 * @ignore
 */
export declare const platform: import('../types').Platform;
/**
 * Device
 * @ignore
 */
export declare const device: import('../types').Device;
/**
 * List of Windy's supported languages
 */
export declare const supportedLanguages: readonly [
  'en',
  'zh-TW',
  'zh',
  'ja',
  'fr',
  'ko',
  'it',
  'ru',
  'nl',
  'cs',
  'tr',
  'pl',
  'sv',
  'fi',
  'ro',
  'el',
  'hu',
  'hr',
  'ca',
  'da',
  'ar',
  'fa',
  'hi',
  'ta',
  'sk',
  'uk',
  'bg',
  'he',
  'is',
  'lt',
  'et',
  'vi',
  'sl',
  'sr',
  'id',
  'th',
  'sq',
  'pt',
  'nb',
  'es',
  'de',
  'bn',
];
/**
 * Server used to download weather data files. DO NOT PUT TRAILING "/" TO THE URL
 * @ignore
 */
export declare const server: string;
/**
 * Server, where our node.js APIs are running. DO NOT PUT TRAILING "/" TO THE URL
 * @ignore
 */
export declare let nodeServer: string;
/**
 * For debugging purposes, you can change the server used to query our APIs
 * @ignore
 */
export declare const setNodeServer: (value: string) => void;
/**
 * Map tile server
 * @ignore
 */
export declare const tileServer: string;
/**
 * Community forum DO NOT PUT TRAILING "/" TO THE URL
 * @ignore
 */
export declare const community = '<!-- @echo NODEBB_HOST -->';
/**
 * Where all the assets (libs,fonts,plugins,lang files) are located
 *
 * if (DEBUG && TARGET_LIB)  assets = 'http://prod.windy.com:8000/v/' + W.assets;
 *
 * @ignore
 */
export declare const assets: string;
/**
 * Supported list of weather levels
 */
export declare const levels: readonly [
  'surface',
  '100m',
  '975h',
  '950h',
  '925h',
  '900h',
  '850h',
  '800h',
  '700h',
  '600h',
  '500h',
  '400h',
  '300h',
  '250h',
  '200h',
  '150h',
  '10h',
];
/**
 * Directory containing latest weather icons
 * @ignore
 */
export declare const iconsDir = '<!-- @echo IMG_RELATIVE_PATH -->/icons7';
/**
 * List of valid overlay identifiers
 */
export declare const overlays: readonly [
  'radar',
  'satellite',
  'wind',
  'gust',
  'gustAccu',
  'turbulence',
  'icing',
  'rain',
  'rainAccu',
  'snowAccu',
  'snowcover',
  'ptype',
  'thunder',
  'temp',
  'dewpoint',
  'rh',
  'deg0',
  'wetbulbtemp',
  'solarpower',
  'uvindex',
  'clouds',
  'hclouds',
  'mclouds',
  'lclouds',
  'fog',
  'cloudtop',
  'cbase',
  'visibility',
  'cape',
  'ccl',
  'waves',
  'swell1',
  'swell2',
  'swell3',
  'wwaves',
  'sst',
  'currents',
  'currentsTide',
  'no2',
  'pm2p5',
  'aod550',
  'gtco3',
  'tcso2',
  'go3',
  'cosc',
  'dustsm',
  'pressure',
  'efiTemp',
  'efiWind',
  'efiRain',
  'capAlerts',
  'soilMoisture40',
  'soilMoisture100',
  'moistureAnom40',
  'moistureAnom100',
  'drought40',
  'drought100',
  'fwi',
  'dfm10h',
];
/**
 * List of valid accumulation times
 */
export declare const acTimes: readonly [
  'next12h',
  'next24h',
  'next36h',
  'next2d',
  'next48h',
  'next60h',
  'next3d',
  'next5d',
  'next10d',
];
/**
 * Identifier of products that cover only certain area
 */
export declare const localProducts: readonly [
  'nems',
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconEu',
  'iconD2',
  'arome',
  'aromeAntilles',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'iconEuWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
];
/**
 * Identifiers of global products
 */
export declare const globalProducts: readonly [
  'gfs',
  'ecmwf',
  'ecmwfAnalysis',
  'ecmwfAifs',
  'radar',
  'ecmwfWaves',
  'gfsWaves',
  'icon',
  'iconWaves',
  'capAlerts',
  'cams',
  'efi',
  'satellite',
  'cmems',
  'drought',
  'fireDanger',
  'activeFires',
];
/**
 * Identifiers of sea products
 */
export declare const seaProducts: readonly [
  'ecmwfWaves',
  'gfsWaves',
  'iconWaves',
  'iconEuWaves',
  'canRdwpsWaves',
  'cmems',
  'jmaCwmWaves',
];
/**
 * Identifiers of wave products, if product is not here, it will be considered as air product
 */
export declare const waveProducts: readonly [
  'ecmwfWaves',
  'gfsWaves',
  'iconWaves',
  'iconEuWaves',
  'jmaCwmWaves',
  'canRdwpsWaves',
];
/**
 * identifiers of air quality product
 */
export declare const airQualityProducts: readonly ['cams', 'camsEu'];
/**
 * identifiers of local products, that have point forecast
 */
export declare const localPointProducts: readonly [
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconD2',
  'iconEu',
  'iconEuWaves',
  'arome',
  'aromeAntilles',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
];
/**
 * Identifiers of global products, that have point forecast
 */
export declare const globalPointProducts: readonly ['gfs', 'ecmwf', 'ecmwfAifs', 'icon', 'mblue'];
/**
 * Identifiers of all land products combined
 */
export declare const products: readonly [
  'gfs',
  'ecmwf',
  'ecmwfAnalysis',
  'ecmwfAifs',
  'radar',
  'ecmwfWaves',
  'gfsWaves',
  'icon',
  'iconWaves',
  'capAlerts',
  'cams',
  'efi',
  'satellite',
  'cmems',
  'drought',
  'fireDanger',
  'activeFires',
  'nems',
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconEu',
  'iconD2',
  'arome',
  'aromeAntilles',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'iconEuWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
  'cams',
  'camsEu',
  'mblue',
];
/**
 * Identifiers of all point products combines
 */
export declare const pointProducts: readonly [
  'gfs',
  'ecmwf',
  'ecmwfAifs',
  'icon',
  'mblue',
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconD2',
  'iconEu',
  'iconEuWaves',
  'arome',
  'aromeAntilles',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
];
/**
 * IndicatesIndicates that that browsing device is mobile
 */
export declare const isMobile: boolean;
/**
 * Indicates that browsing device is tablet
 */
export declare const isTablet: boolean;
/**
 * Indicates that browsing device is mobile or tablet
 */
export declare const isMobileOrTablet: boolean;
/**
 * Indicates that browsing device has retina display
 * @ignore
 */
export declare const isRetina: boolean;
/**
 * Preferred browsers' language (not the used one). Can contain language that is not supported by Windy
 */
export declare const prefLang: string;
/**
 * Valid levels, their identifier and display string
 * @ignore this will crash Markdown parser
 */
export declare const levelsData: {
  [L in (typeof levels)[number]]: [string, string];
};
/**
 * Maximum number of fav POIs displayed in the GUI
 */
export declare const maxFavPoisDesktop = 7;
/**
 * Valid POI layers, their name and icon
 * @ignore this will crash Markdown parser
 */
export declare const pois: Record<Pois, [keyof LoadedTranslations | string, Iconfont]>;
/**
 * List of valid isoline identifiers
 * @ignore this will crash Markdown parser
 */
export declare const isolines: Isolines[];
/**
 * Location of internal Windy plugins
 * TODO: Mobile apps have probably different location
 */
export declare const pluginsLocation: string;
