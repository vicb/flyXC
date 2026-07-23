import type { ArticleImportance } from '@plugins/articles/articles';
import type { Levels } from './d.ts.files/rootScope.d';
import type { DetailDisplayType, LoadedTranslations } from './d.ts.files/types';
import type { PollenDataHash2 } from './d.ts.files/node-forecast-v3.d';
/**
 * Version of Windy.com client (as taken from package.json)
 * @deprecated Use `VERSION` env variable instead.
 */
export declare const version: `${number}.${number}.${number}`;
/**
 * Target
 * @deprecated Use `TARGET` env variable instead.
 */
export declare const target: 'mobile' | 'index' | 'lib' | 'embed';
/**
 * Platform
 */
export declare const platform: import('@windy/types').Platform;
/**
 * Device
 */
export declare const device: import('@windy/types').Device;
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
 */
export declare const server: string;
/**
 * Where all the assets (libs,fonts,plugins,lang files) are located
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
 */
export declare const iconsDir: string;
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
  'wavePower',
  'aqi',
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
  'avalancheDanger',
  'soilMoisture40',
  'soilMoisture100',
  'moistureAnom40',
  'moistureAnom100',
  'drought40',
  'drought100',
  'fwi',
  'dfm10h',
  'dfm100h',
  'dfm1000h',
  'heatmaps',
  'topoMap',
  'hurricanes',
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
  'aromeFrance',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'czeAladin',
  'iconEuWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'bomAccessAd',
  'bomAccessBn',
  'bomAccessDn',
  'bomAccessNq',
  'bomAccessPh',
  'bomAccessSy',
  'bomAccessVt',
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
  'radar',
  'ecmwfWaves',
  'gfsWaves',
  'icon',
  'capAlerts',
  'avalancheDanger',
  'cams',
  'efi',
  'satellite',
  'cmems',
  'drought',
  'fireDanger',
  'activeFires',
  'topoMap',
];
/**
 * Identifiers of sea products
 */
export declare const seaProducts: readonly [
  'ecmwfWaves',
  'gfsWaves',
  'iconEuWaves',
  'canRdwpsWaves',
  'cmems',
  'jmaCwmWaves',
];
/**
 * Identifiers of wave products, if product is not here, it will be considered as air product
 */
export declare const waveProducts: readonly ['ecmwfWaves', 'gfsWaves', 'iconEuWaves', 'jmaCwmWaves', 'canRdwpsWaves'];
/**
 * Specific point only produc
 */
export declare const pointForecastOnlyGlobalProducts: readonly ['mblue'];
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
  'aromeFrance',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'czeAladin',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'bomAccessAd',
  'bomAccessBn',
  'bomAccessDn',
  'bomAccessNq',
  'bomAccessPh',
  'bomAccessSy',
  'bomAccessVt',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
];
/**
 * Identifiers of global products, that have point forecast
 */
export declare const globalPointProducts: readonly ['mblue', 'gfs', 'ecmwf', 'icon'];
/**
 * These products are allowed as preferred fallback air product.
 * It is here just for easy typings so feel free to add any
 */
export declare const fallbackAirProducts: readonly ['gfs', 'ecmwf', 'jmaMsm', 'canHrdps', 'iconEu'];
/**
 * Identifiers of all land products combined
 */
export declare const products: readonly [
  'mblue',
  'gfs',
  'ecmwf',
  'ecmwfAnalysis',
  'radar',
  'ecmwfWaves',
  'gfsWaves',
  'icon',
  'capAlerts',
  'avalancheDanger',
  'cams',
  'efi',
  'satellite',
  'cmems',
  'drought',
  'fireDanger',
  'activeFires',
  'topoMap',
  'nems',
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconEu',
  'iconD2',
  'arome',
  'aromeAntilles',
  'aromeFrance',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'czeAladin',
  'iconEuWaves',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'bomAccessAd',
  'bomAccessBn',
  'bomAccessDn',
  'bomAccessNq',
  'bomAccessPh',
  'bomAccessSy',
  'bomAccessVt',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
  'cams',
  'camsEu',
  'ecmwfWaves',
  'gfsWaves',
  'iconEuWaves',
  'jmaCwmWaves',
  'canRdwpsWaves',
];
/**
 * Identifiers of all point products combines
 */
export declare const pointProducts: readonly [
  'ecmwfWaves',
  'gfsWaves',
  'iconEuWaves',
  'jmaCwmWaves',
  'canRdwpsWaves',
  'mblue',
  'gfs',
  'ecmwf',
  'icon',
  'namConus',
  'namHawaii',
  'namAlaska',
  'iconD2',
  'iconEu',
  'iconEuWaves',
  'arome',
  'aromeAntilles',
  'aromeFrance',
  'aromeReunion',
  'canHrdps',
  'canRdwpsWaves',
  'camsEu',
  'czeAladin',
  'hrrrAlaska',
  'hrrrConus',
  'bomAccess',
  'bomAccessAd',
  'bomAccessBn',
  'bomAccessDn',
  'bomAccessNq',
  'bomAccessPh',
  'bomAccessSy',
  'bomAccessVt',
  'ukv',
  'jmaMsm',
  'jmaCwmWaves',
  'cams',
  'camsEu',
];
/**
 * Point products that have air point forecast
 */
export declare const airPointProducts: (
  | 'icon'
  | 'ecmwfWaves'
  | 'gfsWaves'
  | 'iconEuWaves'
  | 'jmaCwmWaves'
  | 'canRdwpsWaves'
  | 'mblue'
  | 'gfs'
  | 'ecmwf'
  | 'namConus'
  | 'namHawaii'
  | 'namAlaska'
  | 'iconD2'
  | 'iconEu'
  | 'arome'
  | 'aromeAntilles'
  | 'aromeFrance'
  | 'aromeReunion'
  | 'canHrdps'
  | 'camsEu'
  | 'czeAladin'
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
  | 'cams'
)[];
/**
 * IndicatesIndicates that that browsing device is mobile
 */
export declare const isMobile: boolean;
/**
 * Indicates that browsing device is tablet
 */
export declare const isTablet: boolean;
/**
 * Indicates that that browsing device is desktop
 */
export declare const isDesktop: boolean;
/**
 * Indicates that browsing device is mobile or tablet
 */
export declare const isMobileOrTablet: boolean;
/**
 * Indicates that browsing device is tablet or desktop
 */
export declare const isDesktopOrTablet: boolean;
/**
 * Indicates that browsing device has retina display
 */
export declare const isRetina: boolean;
/**
 * Valid levels, their identifier and display string
 * @note this will crash Markdown parser
 */
export declare const levelsData: {
  [L in Levels]: [string, string, meters: number, feet: number];
};
/**
 * Maximum number of fav POIs displayed in the GUI
 */
export declare const maxFavPoisDesktop = 7;
/**
 * Valid POI layers, their name and icon
 * @note this will crash Markdown parser
 */
export declare const pois: {
  readonly favs: {
    readonly title: 'POI_FAVS';
    readonly icon: 'k';
  };
  readonly cities: {
    readonly title: 'POI_FCST';
    readonly icon: '&';
  };
  readonly stations: {
    readonly title: 'POI_STATIONS';
    readonly icon: '';
  };
  readonly wind: {
    readonly title: 'POI_WIND';
    readonly titleShort: 'POI_WIND_SHORT';
    readonly icon: '|';
  };
  readonly temp: {
    readonly title: 'POI_TEMP';
    readonly titleShort: 'POI_TEMP_SHORT';
    readonly icon: '';
  };
  readonly precip: {
    readonly title: 'POI_PRECIP';
    readonly titleShort: 'POI_PRECIP_SHORT';
    readonly icon: 'H';
  };
  readonly metars: {
    readonly title: 'POI_AD';
    readonly icon: 'Q';
  };
  readonly cams: {
    readonly title: 'POI_CAMS';
    readonly icon: 'l';
  };
  readonly pgspots: {
    readonly title: 'POI_PG';
    readonly icon: '';
  };
  readonly kitespots: {
    readonly title: 'POI_KITE';
    readonly icon: '';
  };
  readonly surfspots: {
    readonly title: 'POI_SURF';
    readonly icon: '{';
  };
  readonly tide: {
    readonly title: 'POI_TIDE';
    readonly icon: 'q';
  };
  readonly firespots: {
    readonly title: 'ACTIVE_FIRES';
    readonly icon: '';
  };
  readonly airq: {
    readonly title: 'POI_AIRQ';
    readonly icon: '';
  };
  readonly radiosonde: {
    readonly title: 'POI_RADIOSONDE';
    readonly icon: '';
  };
  readonly empty: {
    readonly title: 'POI_EMPTY';
    readonly icon: 't';
  };
};
export declare const poiGroups: Partial<Record<keyof typeof pois, (keyof typeof pois)[]>>;
/**
 * List of valid isoline identifiers
 * @note this will crash Markdown parser
 */
export declare const isolinesType: readonly ['pressure', 'gh', 'temp', 'deg0'];
/**
 * Location of internal Windy plugins
 */
export declare const pluginsLocation: string;
export declare const pollenProducts: Record<
  keyof PollenDataHash2,
  [longTranslation: keyof LoadedTranslations, shortTranslation: keyof LoadedTranslations]
>;
/**
 * Articles of this importance are opened automatically on app start
 */
export declare const autoOpenArticleImportance: ArticleImportance;
export declare const detailDefaults: {
  pointFcstDisplay: DetailDisplayType;
  forecastDaysLength: number;
};
