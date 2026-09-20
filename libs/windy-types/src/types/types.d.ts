import { MainLangFile, PluginTranslations } from '@windy/lang-files.d';

// eslint-disable-next-line custom/no-plugins-import-in-src
import weatherTable from '@plugins/shared/detail-render/weatherTable';

import { LatLon, WeatherParameters } from '@windy/interfaces.d';
import { Levels } from '@windy/rootScope.d';

export * from '@windy/interpolatorTypes.d';

export type LevelsRange = `${Levels}-${Levels}`;

/**
 * ISO date string representation of the Date
 */
export type ISODateString = string;

/**
 * Point in time expressed as milliseconds since Unix epoch (Date.now()).
 * Use {@link TimeRangeMs} instead for durations/interval lengths.
 */
export type Timestamp = number;

/**
 * Time range / duration in milliseconds (NOT an absolute epoch timestamp)
 */
export type TimeRangeMs = number;

/**
 * Path in a form of YYYYMMDDHH based on minifest/calendar version
 */
export type Path = string;

/**
 * Valid subscription tiers
 */
export type SubTier = 'premium' | null;

export type Platform = 'android' | 'ios' | 'desktop';

export type Device = 'mobile' | 'tablet' | 'desktop';

export type DetailDisplayType = 'table' | 'meteogram' | 'airgram' | 'waves' | 'wind' | 'airq';

export type Directions = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Meteorological numerical value (usually in default metric as delivered from backend)
 */
export type NumValue = number;

export type NumOrNull = NumValue | null;

/**
 * Format for writing a date as "YYYY-MM-DD"
 */
export type YearMonthDay = string;

export type StationType = 'ad' | 'wmo' | 'madis' | 'buoy' | 'dbuoy' | 'pws' | 'ship';
export type PoiType = 'airq' | 'pgspots' | 'surfspots' | 'tide';
export type ExtendedStationType = StationType | 'airq';

export type StationId = `${ExtendedStationType}-${string}`;

/**
 * Type of POI that detail can be open with
 */
export type StationOrPoiType = StationType | PoiType;

export type FlyingConditions = 'I' | 'V' | 'L' | 'M' | 'U';

/**
 * Allowed type of tides
 */
export type TideIdent = 'HT' | 'LT' | 'ME' | 'MF' | 'NE' | 'NF' | 'SE' | 'SF' | 'FT' | 'ET';

export type AqiPollutant =
    | 'bc'
    | 'co'
    | 'co2'
    | 'no'
    | 'no2'
    | 'nox'
    | 'o3'
    | 'pm10'
    | 'pm25'
    | 'so2';

/**
 * Fully enclosed and valid HTML string, that can be inserted as innerHTML to DOM
 * NEVER use for partial HTML codes
 */
export type HTMLString = string;

/**
 * Supported types or table rows as used by @plugin/detail-render and @plugin/detail
 */
export type DetailRows = keyof typeof weatherTable;

/**
 * Width/Height or screen position in Pixels
 */
export type Pixel = number;

export type SveltePluginIdent = `@plugins/${keyof import('@windy/plugins.d').SveltePlugins}`;

export type SveltePanePluginIdent =
    `@plugins/${keyof import('@windy/plugins.d').SveltePanePlugins}`;

export type SveltePopupPluginIdent =
    `@plugins/${keyof import('@windy/plugins.d').SveltePopupPlugins}`;

export type BottomSveltePluginIdent =
    `@plugins/${keyof import('@windy/plugins.d').BottomSveltePlugins}`;

export type StartupElementPluginIdent =
    `@plugins/${keyof import('@windy/plugins.d').StartupElementPlugins}`;

export type TagPluginIdent = `@plugins/${keyof import('@windy/plugins.d').TagPlugins}`;

export type PlainPluginIdent = `@plugins/${keyof import('@windy/plugins.d').PlainPlugins}`;

export type AllPluginIdent = `@plugins/${keyof import('@windy/plugins.d').Plugins}`;

export type CapAlertSeverity =
    | 'M' /** moderate **/
    | 'S' /** severe **/
    | 'E' /** extreme **/
    | 'A' /** unknown **/;

export type CapAlertType =
    | 'T' /** thunderstorm **/
    | 'R' /** rain **/
    | 'H' /** heat **/
    | 'W' /** wind **/
    | 'F' /** flood **/
    | 'L' /** low temp **/
    | 'C' /** coastal warning **/
    | 'I' /** fires **/
    | 'G' /** fog **/
    | 'N' /** tornado **/
    | 'Q' /** air quality  */
    /** these two are new not implemented in client **/
    | 'S' /** snow ice **/
    | 'A' /** avalanche **/
    | '-' /** invalid */;

export type CapAlertInfo = Record<
    string,
    {
        event: string;
        description: string;
        instruction: string;
        senderName: string;
        headline: string;
    }
>;

export type RouteType = 'car' | 'vfr' | 'ifr' | 'elevation' | 'boat' | 'airgram';

export type RouteMotionSpeed = {
    [key in RouteType]: number;
};

export type LocationPreferences = {
    status:
        | 'notDetermined' // Native popup asking for location permission, was not shown yet.
        | 'restricted' // The user cannot change this app’s status, possibly due to active restrictions such as parental controls being in place.
        | 'denied' // User disabled app permissions, turned off device location, or enabled Airplane mode.
        | 'authorized' // Deprecated
        | 'authorizedAlways' // This authorization allows you to use all location services and receive location events whether or not your app is in use.
        | 'authorizedWhenInUse' // This authorization allows you to use location services only when your app is in the foreground.
        | 'unknownState'; // Device may not have location services
};

export type NotificationPreferences = {
    status: 'notDetermined' | 'denied' | 'authorized' | 'provisional' | 'unknownState';
};

export type GpsPreferences = {
    status: 'denied' | 'authorized';
};

/**
 * Implemented only on android native - iOS does not restrict battery usage for individual applications
 */
export type BatteryPreferences = {
    status: 'denied' | 'authorized';
};

export type WidgetNotificationPreferences = {
    status: 'denied' | 'authorized';
};

export type GoogleServicesPreferences = {
    status: 'denied' | 'authorized';
};

export type WidgetType = {
    widget_type: 'satellite' | 'radar' | 'webcam' | 'detail' | 'days';
};

export type ErrorCategory = 'location' | 'notification' | 'iCloud' | 'battery';

export type ShowableError = {
    errorId:
        | 'ICLOUD_9' /** iCloud denied by user settings **/
        | 'ICLOUD_25' /** Users iCloud has full storage **/
        | 'LOC_1' /** Location services disabled in device (for device Android) **/
        | 'LOC_2' /** Location services disabled for application */
        | 'NOTIF_1' /** Notification services disabled **/
        | 'BATTERY_1' /** Battery usage restricted */
        | 'BACKGROUND_LOCATION_1' /** Background location usage disabled */
        | 'WIDGET_NOTIFICATION_1' /** Notifications disabled for widgets */;
    category: ErrorCategory;
};

export type ShowableErrors = {
    unresolved: Map<string, ShowableError>;
    closed: Set<string>;
};

/**
 * Overlay categories used for better UI navigation (mobile/tablet)
 */
export type MenuCategory =
    | 'wind'
    | 'rain'
    | 'sea'
    | 'airQ'
    | 'drought'
    | 'temp'
    | 'warnings'
    | 'clouds';

/**
 * Overlay categories used for better UI navigation (desktop)
 */
export type MenuCategoryDesktop =
    | 'nowcast'
    | 'wind'
    | 'rain'
    | 'sea'
    | 'airQ'
    | 'temp'
    | 'clouds'
    | 'warnings';

/**
 * Overlay categories used for better UI navigation
 */
export type MenuItems = MenuCategory | 'all' | 'search';

/**
 * How long should picker-mobile stay open after user interaction
 * It is string because of UI component dropdown returns string
 */
export type PickerMobileTimeout = '3' | '6' | '9' | '12' | 'always';

/**
 * Only these first level paths are allowed to be used in log
 */
export type LogPaths =
    | keyof WeatherParameters
    | 'path'
    | 'version'
    | 'plugin'
    | 'pois'
    | 'startup'
    | 'subscription'
    | '404'
    | 'promo'
    | 'airport'
    | 'appRating'
    | 'appOpening'
    | 'articles'
    | 'detail2'
    | 'appsflyer'
    | 'onboarding'
    | 'station'
    | 'weather'
    | 'events'
    | 'locationPermissionPopup'
    | 'widgetPromo'
    | 'storyEvent'
    | 'garmin'
    | 'routePlanner'
    | 'garminEdge';

export type LogEvents =
    | 'logout'
    | 'animation-started'
    | 'animation-speed-changed'
    | 'user-logged'
    | 'click-on-hp'
    | 'article-event'
    | 'displayed-on-hp'
    | 'subs-opened'
    | 'subs-purchased'
    | 'map-selector-clicked'
    | 'radsat-animation-speed-changed'
    | 'login-finish-action';

/**
 * Type of user consent
 */
export type ConsentType = 'pending' | 'rejected' | 'analytics';

export type ProductCategory = 'analysis' | 'forecast';

export type ProductIdent =
    | 'nam-conus'
    | 'nam-hawaii'
    | 'nam-alaska'
    | 'icon-eu'
    | 'icon-d2'
    | 'arome'
    | 'arome-antilles'
    | 'arome-france'
    | 'arome-reunion'
    | 'can-hrdps'
    | 'can-rdwps'
    | 'cams-global'
    | 'cams-eu'
    | 'cze-aladin'
    | 'icon-global'
    | 'icon-gwam'
    | 'icon-ewam'
    | 'hrrr-alaska'
    | 'hrrr-conus'
    | 'bom-access'
    | 'bom-access-c-ad'
    | 'bom-access-c-bn'
    | 'bom-access-c-dn'
    | 'bom-access-c-nq'
    | 'bom-access-c-ph'
    | 'bom-access-c-sy'
    | 'bom-access-c-vt'
    | 'ukv'
    | 'gfs'
    | 'gfs-wave'
    | 'ecmwf-hres'
    | 'ecmwf-wam'
    | 'ecmwf-efi'
    | 'mbeurope'
    | 'cmems'
    | 'intersucho'
    | 'intersucho-firerisk'
    | 'intersucho-firerisk-hourly'
    | 'nasa-firms'
    | 'jma-msm'
    | 'jma-cwm';

export type PickerOpener = LatLon & { id: string };

export type ExternalPluginIdent = `windy-plugin-${string}`;

export type AllowedDropDownKey = string | number | null | boolean;

export type DropDownValues = { key: AllowedDropDownKey; value: string | number }[];

/*
 * Plugin for creating backups of Local storage
 * This plugin is needed from iOS 17.2, because iOS is clearing WebKit localstorage
 */
export type WindyBackupPluginInfo = {
    nativeCounter: number;
    backup?: string;
    lastBackup: number;
    lastBackupTriggered: number;
    triggerCounter: number;
    deviceID: string;
    vendorID?: string;
};
export interface WindyBackupPlugin {
    // Compare client counter and if is older (most likely zero, when cleared)
    // will return saved data if exist
    syncCounter: (arg: {
        clientCounter: number;
    }) => Promise<{ nativeCounter: number; backup?: string }>;
    // Save current state of LocalStorage to native persistent Storage
    saveBackup: (arg: { clientCounter: number; backup: string }) => Promise<void>;
    // Reloads WebView from origin, to correctly load state of the app
    reloadApp: () => Promise<void>;
    // Clear native backup and resets native counter
    clearBackup: () => Promise<void>;
    // Returns info about native backup
    backupInfo: () => Promise<WindyBackupPluginInfo>;
}

/**
 * Currently used main map library
 */
export type UsedMapLibrary = 'leafletGl' | 'globe';

/**
 * Time defined in hours
 */
export type Hours = number;

/**
 * Time defined in minutes
 */
export type Minutes = number;

/**
 * Time defined in seconds
 */
export type Seconds = number;

/**
 * All defined translation keys
 *
 * WARNING: Given lang files MUST be lazy loded before using the key
 */
export type LoadedTranslations = MainLangFile & PluginTranslations;

export type UserInterest =
    | 'outdoor_activities'
    | 'water_sports'
    | 'winter_sports'
    | 'wind_sports'
    | 'aviation'
    | 'boating'
    | 'agriculture'
    | 'meteorologist'
    | 'other';

export type ParticlesIdent = 'wind' | 'waves' | 'currents';

export type PatternType = 'cclPattern' | 'rainPattern' | 'ptypePattern';

export type TransformFunction = (x: NumValue) => NumValue;

export type RenderChannels = 'R' | 'RG' | 'B';

export type ParsedQueryString = Record<string, string | undefined>;

export type Size = 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'xxxl' | 'ultra';

export type RGBA = [number, number, number, number];

export type YUVA = [number, number, number, number];

export type ColorGradient = [NumValue, RGBA][];

export type ColorGradientString = [NumValue, RGBString | RGBAString][];

export type AnimationSpeed = 'normal' | 'fast' | 'very-fast';

/**
 * 'rgb(200,0,150)'
 */
export type RGBString = `rgb(${number},${number},${number})`;

/**
 * 'rgba(200,0,150,1)'
 */
export type RGBAString = `rgba(${number},${number},${number},${number})`;

/**
 * Custom app icon for Premium users
 */
export type CustomAppIcon =
    | 'aviation'
    | 'boating'
    | 'cycling'
    | 'default'
    | 'hiking'
    | 'outdoor'
    | 'paragliding'
    | 'premium'
    | 'running'
    | 'scientist'
    | 'swimming'
    | 'water-sports'
    | 'wind'
    | 'windsurfing'
    | 'winter-sports';

/**
 * All ISO 3166-1 alpha-2 country codes (current), lowercase.
 */
export type ISOCountryCode =
    | 'ad'
    | 'ae'
    | 'af'
    | 'ag'
    | 'ai'
    | 'al'
    | 'am'
    | 'ao'
    | 'aq'
    | 'ar'
    | 'as'
    | 'at'
    | 'au'
    | 'aw'
    | 'ax'
    | 'az'
    | 'ba'
    | 'bb'
    | 'bd'
    | 'be'
    | 'bf'
    | 'bg'
    | 'bh'
    | 'bi'
    | 'bj'
    | 'bl'
    | 'bm'
    | 'bn'
    | 'bo'
    | 'bq'
    | 'br'
    | 'bs'
    | 'bt'
    | 'bv'
    | 'bw'
    | 'by'
    | 'bz'
    | 'ca'
    | 'cc'
    | 'cd'
    | 'cf'
    | 'cg'
    | 'ch'
    | 'ci'
    | 'ck'
    | 'cl'
    | 'cm'
    | 'cn'
    | 'co'
    | 'cr'
    | 'cu'
    | 'cv'
    | 'cw'
    | 'cx'
    | 'cy'
    | 'cz'
    | 'de'
    | 'dj'
    | 'dk'
    | 'dm'
    | 'do'
    | 'dz'
    | 'ec'
    | 'ee'
    | 'eg'
    | 'eh'
    | 'er'
    | 'es'
    | 'et'
    | 'fi'
    | 'fj'
    | 'fk'
    | 'fm'
    | 'fo'
    | 'fr'
    | 'ga'
    | 'gb'
    | 'gd'
    | 'ge'
    | 'gf'
    | 'gg'
    | 'gh'
    | 'gi'
    | 'gl'
    | 'gm'
    | 'gn'
    | 'gp'
    | 'gq'
    | 'gr'
    | 'gs'
    | 'gt'
    | 'gu'
    | 'gw'
    | 'gy'
    | 'hk'
    | 'hm'
    | 'hn'
    | 'hr'
    | 'ht'
    | 'hu'
    | 'id'
    | 'ie'
    | 'il'
    | 'im'
    | 'in'
    | 'io'
    | 'iq'
    | 'ir'
    | 'is'
    | 'it'
    | 'je'
    | 'jm'
    | 'jo'
    | 'jp'
    | 'ke'
    | 'kg'
    | 'kh'
    | 'ki'
    | 'km'
    | 'kn'
    | 'kp'
    | 'kr'
    | 'kw'
    | 'ky'
    | 'kz'
    | 'la'
    | 'lb'
    | 'lc'
    | 'li'
    | 'lk'
    | 'lr'
    | 'ls'
    | 'lt'
    | 'lu'
    | 'lv'
    | 'ly'
    | 'ma'
    | 'mc'
    | 'md'
    | 'me'
    | 'mf'
    | 'mg'
    | 'mh'
    | 'mk'
    | 'ml'
    | 'mm'
    | 'mn'
    | 'mo'
    | 'mp'
    | 'mq'
    | 'mr'
    | 'ms'
    | 'mt'
    | 'mu'
    | 'mv'
    | 'mw'
    | 'mx'
    | 'my'
    | 'mz'
    | 'na'
    | 'nc'
    | 'ne'
    | 'nf'
    | 'ng'
    | 'ni'
    | 'nl'
    | 'no'
    | 'np'
    | 'nr'
    | 'nu'
    | 'nz'
    | 'om'
    | 'pa'
    | 'pe'
    | 'pf'
    | 'pg'
    | 'ph'
    | 'pk'
    | 'pl'
    | 'pm'
    | 'pn'
    | 'pr'
    | 'ps'
    | 'pt'
    | 'pw'
    | 'py'
    | 'qa'
    | 're'
    | 'ro'
    | 'rs'
    | 'ru'
    | 'rw'
    | 'sa'
    | 'sb'
    | 'sc'
    | 'sd'
    | 'se'
    | 'sg'
    | 'sh'
    | 'si'
    | 'sj'
    | 'sk'
    | 'sl'
    | 'sm'
    | 'sn'
    | 'so'
    | 'sr'
    | 'ss'
    | 'st'
    | 'sv'
    | 'sx'
    | 'sy'
    | 'sz'
    | 'tc'
    | 'td'
    | 'tf'
    | 'tg'
    | 'th'
    | 'tj'
    | 'tk'
    | 'tl'
    | 'tm'
    | 'tn'
    | 'to'
    | 'tr'
    | 'tt'
    | 'tv'
    | 'tw'
    | 'tz'
    | 'ua'
    | 'ug'
    | 'um'
    | 'us'
    | 'uy'
    | 'uz'
    | 'va'
    | 'vc'
    | 've'
    | 'vg'
    | 'vi'
    | 'vn'
    | 'vu'
    | 'wf'
    | 'ws'
    | 'ye'
    | 'yt'
    | 'za'
    | 'zm'
    | 'zw';

export type Timeout = ReturnType<typeof setTimeout>;

export type Interval = ReturnType<typeof setInterval>;

export type SemVersion = `${number}.${number}.${number}`;

export type DefaultPointModel = 'ecmwf' | 'mblue';
