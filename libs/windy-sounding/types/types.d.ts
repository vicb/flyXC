import { MainLangFile, PluginTranslations } from '@windy/lang-files.d';

import weatherTable from '@plugins/_shared/detail-render/weatherTable';
import { LatLon, WeatherParameters } from './interfaces.d';

export * from '@windy/interpolatorTypes.d';

/**
 * ISO date string representation of the Date
 */
export type ISODateString = string;

/**
 * Timestamp or any time duration in ms
 */
export type Timestamp = number;

/**
 * Path in a form of YYYY/MM/DD/HH or YYYYMMDDHH based on minifest/calendar version
 */
export type Path = string;

/**
 * String in a form YYYYMMDDHH
 */
export type YYYYMMDDHH = string;

/**
 * Valid subscription tiers
 */
export type SubTier = 'premium' | null;

export type Platform = 'android' | 'ios' | 'desktop';

export type Device = 'mobile' | 'tablet' | 'desktop';

export type DetailDisplayType = 'table' | 'meteogram' | 'airgram' | 'waves' | 'wind';

export type Directions = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type HTMLElementWithSlider = HTMLElement & { noUiSlider?: noUiSlider.noUiSlider };

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
export type PoiType = 'airq' | 'pgspots' | 'surfspots' | 'radiation' | 'tide';
export type ExtendedStationType = StationType | 'radiation' | 'airq';

export type StationId = `${ExtendedStationType}-${string}`;

/**
 * Type of POI that detail can be open with
 */
export type StationOrPoiType = StationType | PoiType;

export type FlightCategory = 'I' | 'V' | 'L' | 'M' | 'U';

/**
 * Allowed type of tides
 */
export type TideIdent = 'HT' | 'LT' | 'ME' | 'MF' | 'NE' | 'NF' | 'SE' | 'SF' | 'FT' | 'ET';

export type AqiPollutant = 'bc' | 'co' | 'co2' | 'no' | 'no2' | 'nox' | 'o3' | 'pm10' | 'pm25' | 'so2';

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

export type SveltePanePluginIdent = `@plugins/${keyof import('@windy/plugins.d').SveltePanePlugins}`;

export type BottomSveltePluginIdent = `@plugins/${keyof import('@windy/plugins.d').BottomSveltePlugins}`;

export type TagPluginIdent = `@plugins/${keyof import('@windy/plugins.d').TagPlugins}`;

export type PlainPluginIdent = `@plugins/${keyof import('@windy/plugins.d').PlainPlugins}`;

export type AllPluginIdent = `@plugins/${keyof import('@windy/plugins.d').Plugins}`;

export type MeteogramLayers = 'dewpoint' | 'gh' | 'rh' | 'temp' | 'wind_u' | 'wind_v';

export type MeteogramLevels =
  | '950h'
  | '925h'
  | '900h'
  | '850h'
  | '800h'
  | '700h'
  | '600h'
  | '500h'
  | '400h'
  | '300h'
  | '200h'
  | '150h'
  | '1000h'
  | 'surface';

export type CapAlertSeverity = 'M' /** moderate **/ | 'S' /** severe **/ | 'E' /** extreme **/ | 'A' /** unknown **/;

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
export type MenuCategory = 'wind' | 'rain' | 'sea' | 'airQ' | 'drought' | 'temp' | 'warnings' | 'clouds';

/**
 * Overlay categories used for better UI navigation (desktop)
 */
export type MenuCategoryDesktop = 'nowcast' | 'wind' | 'rain' | 'sea' | 'airQ' | 'temp' | 'clouds' | 'warnings';

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
  | 'garmin';

export type LogEvents =
  | 'logout'
  | 'animation-started'
  | 'user-logged'
  | 'click-on-hp'
  | 'article-event'
  | 'displayed-on-hp';

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
  | 'nasa-firms'
  | 'jma-msm'
  | 'jma-cwm';

export type PickerOpener = LatLon & { id: string };

export type ExternalPluginIdent = `windy-plugin-${string}`;

export type DropDownValues = { key: string | number | null; value: string | number }[];

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
  syncCounter: (arg: { clientCounter: number }) => Promise<{ nativeCounter: number; backup?: string }>;
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
export type UsedMapLibrary = 'leaflet' | 'maplibre' | 'globe';

/**
 * Time defined in hours
 */
export type Hours = number;

export type Minutes = number;

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

export type ParsedQueryString = Record<string, string | undefined>;

export type Size = 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'xxxl' | 'ultra';

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
