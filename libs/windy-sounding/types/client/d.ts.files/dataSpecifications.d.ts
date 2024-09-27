import {
  AcTimes,
  GlobalPointProducts,
  Isolines,
  Levels,
  LocalPointProducts,
  Overlays,
  Pois,
  Products,
  SupportedLanguages,
  type PointProducts,
} from '@windy/rootScope.d';

import { Consent, GeolocationInfo, HomeLocation, InstalledExternalPluginConfig, LatLon } from '@windy/interfaces.d';

import {
  MenuItems,
  Path,
  PickerMobileTimeout,
  ShowableError,
  SubTier,
  Timestamp,
  type RouteMotionSpeed,
} from '@windy/types.d';

import { ColorGradient } from '@windy/Color.d';

import { MetricItem } from '@windy/Metric.d';

import type { SubscriptionInfo } from '@plugins/_shared/subscription-services/subscription-services.d';
import type { DownloadedInfo, OfflineConfiguration } from '@plugins/offline/offline.d';
import type RadarCalendar from '@plugins/radar/calendar/RadarCalendar';
import type SatelliteCalendar from '@plugins/satellite/calendar/SatelliteCalendar';

/**
 * Custom animation particles settings
 */
export interface CustomParticles {
  multiplier: number;
  velocity: number;
  width: number;
  blending: number;
  opacity: number;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email?: string;
  sendToEmail: boolean;
  sendToMobile: boolean;
}

/**
 * # ReverseResult
 *
 * Result of reverse geocoding method.
 */
export interface ReverseResult extends LatLon {
  lang: string;
  region?: string;
  country?: string;
  name: string;
  nameValid?: boolean;
}

export interface Donation {
  ts: Timestamp;
  amount: number;
  sub: string;
}

export interface User {
  avatar?: string;
  email?: string;
  fullname?: string;
  id: number;
  username: string;
  userslug: string;
  verifiedEmail?: string;

  /**
   * Based on user location, cookie consent can be shown to the user if needed
   */
  requiresCookieConsent?: boolean;
}

export interface MapCoordinates extends LatLon {
  source: 'maps' | 'globe';
  zoom: number;
}

/**
 * Main data structure used in dataStore
 */
export interface DataSpecificationsObject<T> {
  /**
   * Default value
   */
  def: T;

  /**
   * Allowed settings (can be string, array or function returning true/false )
   */
  allowed: Readonly<T[]> | ((d: T) => boolean);

  /**
   * Peristent item. Save this item to localStorage
   */
  save?: boolean;

  /**
   * Sync this item with cloud
   */
  sync?: boolean;

  /**
   * Store the value to native iOS/Android mobile app stores
   */
  nativeSync?: boolean;

  /**
   * If false iOS/Android will set this value if exist,
   * and value will not be stored if is null or undefined
   */
  nativeCloudSync?: boolean;

  /**
   * If this is true, the value is sent to the Watch.
   * Now only works for iOS and Apple Watch
   * Note: The implementation for the key/value sent
   * needs to be done on the native site too
   */
  watchSync?: boolean;

  /**
   * Validity compare function
   */
  compare?: <K = T>(obj: K | K[], obj2?: K | K[]) => boolean;

  /**
   * Timestamp of last item update
   */
  update?: Timestamp;

  /**
   * Allow overwrite start-up URL
   * TODO: Refactor. Used only once in router.ts
   */
  allowUrlRewrite?: boolean;

  /**
   * Setter function (will be run before value is set)
   */
  syncSet?: (...args: unknown[]) => T;

  /**
   * Setter function - asynchronous (will be run before value is set)
   */
  asyncSet?: (...args: unknown[]) => Promise<T>;
}

/**
 * # Properties used in @windy/store
 *
 * Allowed properties, that can be used in `@windy/store` methods.
 *
 * Some of the major items you could be interested in are:
 *  `overlay`,
 *  `level`,
 *  `availLevels`,
 *  `acTime`,
 *  `timestamp`,
 *  `isolines`,
 *  `product`,
 *  `particlesAnim`,
 *  `hourFormat`
 */
export interface DataSpecifications {
  /**
   * Color weather overlay, actually displayed on Windy.com.
   *
   * Can be also used to change overlay by
   * calling for example `store.set('overlay', 'gust')` or `store.set('overlay', 'rain')`
   *
   * Use `store.getAllowed('overlay')` to get list of allowed values.
   */
  overlay: DataSpecificationsObject<Overlays>;

  /**
   * Level used for actually displayed overlay or isolines.
   *
   * Can be also used to change level by calling for example
   * `store.set('level', 'surface')` or `store.set('level', '500h')`
   *
   * To get list of available levels for current combination
   * of overlay and data provider use `store.get('availLevels')`
   */
  level: DataSpecificationsObject<Levels>;

  /**
   * Rain/snow accumulated time range. Use `store.getAllowed('acTime')` to get list of allowed values.
   */
  acTime: DataSpecificationsObject<AcTimes>;

  /**
   * Timestamp of actual weather moment. Use freely and without hesitation. Must be valid timestamp in ms, that is
   * in the range of current dataset
   *
   * @example
   * ```js
   * var fiveHours = 5 * 60 * 60 * 1000
   * store.set('timestamp', Date.now() + fiveHours )
   * ```
   */
  timestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Read only value! UTC string containing time of actually rendered data that are available for current overlay and weather model.
   * @ignore
   */
  path: DataSpecificationsObject<Path>;

  /**
   * Read only value! UTC string containing time of actually rendered data that are available for current overlay and weather model.
   */
  isolines: DataSpecificationsObject<Isolines>;

  /**
   * Product is set of weather data, that have same resolution, boundaries, time range and so on.
   * For simplification, you can think of product as a weather model.
   * Use `store.getAllowed('product')` to get list of allowed values.
   */
  product: DataSpecificationsObject<Products>;

  /**
   * Available product for selected `overlay`
   */
  availProducts: DataSpecificationsObject<Products[]>;

  /**
   * Products available for given map boundary
   */
  visibleProducts: DataSpecificationsObject<Products[]>;

  /**
   * Available accumulation times for give overlay and product combination
   */
  availAcTimes: DataSpecificationsObject<AcTimes[]>;

  /**
   * Global fallback product that handles situation
   * when user pans the map out of bounds of local
   * model. Preferred model must have also second wave
   * mode like 'ecmwf' 👉🏻 'ecmwfWaves'
   */
  preferredProduct: DataSpecificationsObject<'ecmwf' | 'gfs' | 'icon' | 'iconEu'>;

  /**
   * If timeline animation is running
   */
  animation: DataSpecificationsObject<boolean>;

  /**
   * Actual calendar (instance of `Calendar`) for selected overlay/product (if it has calendar)
   */
  calendar: DataSpecificationsObject<import('@windy/Calendar').Calendar | null>;

  /**
   * List of levels, that are available for current combination of product and overlay.
   */
  availLevels: DataSpecificationsObject<Levels[]>;

  /**
   * Animation of wind/waves particles over the map. Set value to `on`, or `off` if you wan to hide or show them.
   */
  particlesAnim: DataSpecificationsObject<'on' | 'off' | 'intensive'>;

  /**
   * Last modified timestamp of just rendered data (read only)
   */
  lastModified: DataSpecificationsObject<Timestamp>;

  /**
   * Display graticule over the map
   */
  graticule: DataSpecificationsObject<boolean>;

  /**
   * Display lat/lon on picker
   */
  latlon: DataSpecificationsObject<boolean>;

  /**
   * Desired language for Windy. By default is determined by user's browser setting and set to `auto`.
   * Use `store.getAllowed('lang')` to get list of avail langs defined in `supportedLanguages.
   */
  lang: DataSpecificationsObject<SupportedLanguages | 'auto'>;

  /**
   * Show english map labels instead of localized labels
   */
  englishLabels: DataSpecificationsObject<boolean>;

  /**
   * Display directions in Weather picker as number or as a string (for example NW).
   */
  numDirection: DataSpecificationsObject<boolean>;

  /**
   * Time format, Set it to `12h` or `24h`.
   */
  hourFormat: DataSpecificationsObject<'12h' | '24h'>;

  /**
   * 2 letter lowercase Country Code
   */
  country: DataSpecificationsObject<string>;

  /**
   * Is imperial as default settings (computed property)
   */
  isImperial: DataSpecificationsObject<boolean>;

  /**
   * Type of map shown in detail
   */
  map: DataSpecificationsObject<'sznmap' | 'sat' | 'winter'>;

  /**
   * Show 7 days weather on startup
   */
  showWeather: DataSpecificationsObject<boolean>;

  /**
   * Is WebGL disabled?
   */
  disableWebGL: DataSpecificationsObject<boolean>;

  /**
   * Indicates whether glParticles are on or off
   */
  glParticlesOn: DataSpecificationsObject<boolean>;

  /**
   * Finally used language (the one which is successfully loaded in trans module)
   */
  usedLang: DataSpecificationsObject<SupportedLanguages>;

  /**
   * Particles animation settings
   */
  particles: DataSpecificationsObject<CustomParticles>;

  /**
   * Type of startup & location
   */
  startUp: DataSpecificationsObject<'ip' | 'gps' | 'location' | 'last'>;

  /**
   * Last coords to use in startup
   */
  startUpLastPosition: DataSpecificationsObject<MapCoordinates>;

  /**
   * Last product to use in startup
   */
  startUpLastProduct: DataSpecificationsObject<Products | null>;

  /**
   * User selected home location
   */
  homeLocation: DataSpecificationsObject<HomeLocation | null>;

  /**
   * User selected overlay/model
   */
  startUpOverlay: DataSpecificationsObject<Overlays>;

  /**
   * If true, every overlay change is stored as startUpOverlay
   */
  startUpLastOverlay: DataSpecificationsObject<boolean>;

  /**
   * Save forecast resolution step to be used at startup.
   * 1: 1h step
   * 3: 3h step
   */
  startUpLastStep: DataSpecificationsObject<1 | 3 | null>;

  /**
   * Last defined IP/GPS location
   */
  ipLocation: DataSpecificationsObject<GeolocationInfo | null>;

  /**
   * Latest received GPS location
   */
  gpsLocation: DataSpecificationsObject<GeolocationInfo | null>;

  /**
   * Geo reverse name for purpose of startup location
   */
  startupReverseName: DataSpecificationsObject<ReverseResult | null>;

  /**
   * NOTAMs marked as read
   */
  notams: DataSpecificationsObject<Record<string, number> | null>;

  /**
   * Users email
   */
  email: DataSpecificationsObject<string>;

  /**
   * METARs in raw mode
   */
  metarsRAW: DataSpecificationsObject<boolean>;

  /**
   * Display Heliports that do not report METARs in the POIs layer
   */
  displayHeliports: DataSpecificationsObject<boolean>;

  /**
   * User statistics
   * @ignore
   */
  sessionCounter: DataSpecificationsObject<number>;

  /**
   * User statistics
   * @ignore
   */
  firstUserSession: DataSpecificationsObject<Timestamp>;

  /**
   * Have seen info about low reliability of webGL
   * @ignore
   */
  seenRadarInfo: DataSpecificationsObject<boolean>;

  /**
   * Wheather picker was dragged or not (not settings but info)
   * @ignore
   */
  wasDragged: DataSpecificationsObject<boolean>;

  /**
   * Detail's location - TODO: get rid of async name property
   * @ignore
   */
  detailLocation: DataSpecificationsObject<(LatLon & { name?: string }) | null>;

  /**
   * 1h step of forecast
   */
  detail1h: DataSpecificationsObject<boolean>;

  /**
   * Timestamp of detail's progress bar or middleFrame
   */
  detailTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Detail keeps its 10+ days expanded forecast
   */
  detailExtended: DataSpecificationsObject<boolean>;

  /**
   * display webcams on daylight
   */
  webcamsDaylight: DataSpecificationsObject<boolean>;

  /**
   * display previews of webcams on the map
   */
  camsPreviews: DataSpecificationsObject<boolean>;

  //
  // CAP alerts
  //

  /**
   * Today, tomm, later
   */
  capDisplay: DataSpecificationsObject<'all' | 'today' | 'tomm' | 'later'>;

  /**
   * Range of displayed radar history
   */
  radarRange: DataSpecificationsObject<'archive' | 'long' | 'medium' | 'short'>;

  /**
   * Timestamp in ms
   */
  radarTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Animation speed
   */
  radarSpeed: DataSpecificationsObject<'slow' | 'medium' | 'fast'>;

  /**
   * Radar calendar
   */
  radarCalendar: DataSpecificationsObject<RadarCalendar | null>;

  /**
   * Animation is running
   */
  radarAnimation: DataSpecificationsObject<boolean>;

  /**
   * Visible lightning data on radar
   */
  blitzOn: DataSpecificationsObject<boolean>;

  /**
   * Sound for lightning flash effect on radar
   */
  blitzSoundOn: DataSpecificationsObject<boolean>;

  /**
   * Range of displayed satellite history
   */
  satelliteRange: DataSpecificationsObject<'archive' | 'long' | 'medium' | 'short'>;

  /**
   * Timestamp in ms
   */
  satelliteTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Satellite calendar
   */
  satelliteCalendar: DataSpecificationsObject<SatelliteCalendar | null>;

  /**
   * Satellite animation is running
   */
  satelliteAnimation: DataSpecificationsObject<boolean>;

  /**
   * Satellite visualization modes
   */
  satelliteMode: DataSpecificationsObject<'BLUE' | 'VISIR' | 'IRBT' | 'DBG'>; // 'IR',

  /**
   * Animation speed
   */
  satelliteSpeed: DataSpecificationsObject<'slow' | 'medium' | 'fast'>;

  /**
   * Extrapolate satellite images to future
   */
  satelliteExtraOn: DataSpecificationsObject<boolean>;

  /**
   * this override is needed for video capture
   */
  satelliteInterpolationOverride: DataSpecificationsObject<boolean>;

  /**
   * Satellite/Radar archive on
   */
  archiveOn: DataSpecificationsObject<boolean>;

  /**
   * Timestamp in ms
   */
  archiveTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Archive time range in hours
   */
  archiveRange: DataSpecificationsObject<number>;

  /**
   * Information, if startup weather box is shown or not
   */
  startupWeatherShown: DataSpecificationsObject<boolean>;

  /**
   * pois layer that user selected
   *
   * IMPORTANT: Only user can willingly set his poi layer via
   * clicking on poi control.
   *
   * Plugins and any other parts oc client code can set only
   * `poisTemporary` that has limited lifespan
   */
  pois: DataSpecificationsObject<Pois>;

  /**
   * pois layer that was automatically activated by some plugin
   * or any part of the code.
   *
   * Remember to unset the value to `empty` when closing plugin.
   */
  poisTemporary: DataSpecificationsObject<Pois>;

  /**
   * Favourite pois
   */
  favPois: DataSpecificationsObject<Pois[]>;

  /**
   * Visibility of window/tab
   */
  visibility: DataSpecificationsObject<boolean>;

  /**
   * If user wants to display his location
   * @ignore
   */
  displayLocation: DataSpecificationsObject<boolean>;

  /**
   * Vibration allowed
   * @ignore
   */
  vibrate: DataSpecificationsObject<boolean>;

  /**
   * Donated amounts in 2019
   * [ { ts, amount, sub }, {}, {}, {} ... ]
   * @ignore
   */
  donations: DataSpecificationsObject<Donation[]>;

  /**
   * Display all times in UTC
   */
  zuluMode: DataSpecificationsObject<boolean>;

  /**
   * Sorting of nearest weater stations
   * @ignore
   */
  stationsSort: DataSpecificationsObject<'profi' | 'distance'>;

  /**
   * Which model to compare with in stations detail
   * @ignore
   */
  stationCompareModel: DataSpecificationsObject<LocalPointProducts | GlobalPointProducts | 'noModel'>;

  /**
   * Type of subscription
   * @ignore
   */
  subscription: DataSpecificationsObject<SubTier>;

  /**
   * Detail info about current subscription (if any)
   * @ignore
   */
  subscriptionInfo: DataSpecificationsObject<SubscriptionInfo | null>;

  /**
   * Unredeemed subscription id
   * @ignore
   */
  pendingSubscription: DataSpecificationsObject<string | null>;

  /**
   * Failed subscription payment payload
   * @ignore
   */
  failedSubscriptionPayment: DataSpecificationsObject<string | null>;

  /**
   * Notification preferences
   * @ignore
   */
  notifications: DataSpecificationsObject<NotificationPreferences | null>;

  /**
   * User likes to receive ad hoc pushNotification
   * For instance METAR update.
   * Once set, it always stays on on this device
   * @ignore
   */
  adHocNotification: DataSpecificationsObject<boolean>;

  /**
   * Number of unread notifications
   * @ignore
   */
  badgeNumber: DataSpecificationsObject<number>;

  /**
   * Major object holding user info
   * { username, avatar, userslug, email }
   * @ignore
   */
  user: DataSpecificationsObject<User | null>;

  /**
   * Lazy loaded user JWT containing aut hash
   * Used in http requests requiring authentication as in Accept header from mobile.
   * @ignore
   */
  userToken: DataSpecificationsObject<string | null>;

  /**
   * Store for error during social login
   * @ignore
   */
  socialError: DataSpecificationsObject<string | null>;

  /**
   * authHash containing token with user session on mobile devices
   * Used in http requests requiring authentication as in Accept header from mobile.
   * Historically saved via storage
   * @ignore
   */
  authHash: DataSpecificationsObject<string | null>;

  /**
   * Globe plugin is active (used for disabling isolines in overlays plugin)
   */
  globeActive: DataSpecificationsObject<boolean>;

  /**
   * Webcam or station last location (used for globe picker initial location)
   * @ignore
   */
  lastPoiLocation: DataSpecificationsObject<(LatLon & { type?: string }) | null>;

  /**
   * Picker last location
   */
  pickerLocation: DataSpecificationsObject<LatLon | null>;

  /**
   * Latest maps/globe coordinates
   * @ignore
   */
  mapCoords: DataSpecificationsObject<MapCoordinates | null>;

  /**
   * Whether app has been launched from some source which requires different init state
   * @ignore
   */
  launchedBy: DataSpecificationsObject<'radar-widget' | null>;

  /**
   * Any stored color
   * @ignore
   */
  [key: `color2_${string}`]: DataSpecificationsObject<ColorGradient | null>;

  /**
   * Any stored metric
   * @ignore
   */
  [key: `metric_${string}`]: DataSpecificationsObject<MetricItem | null>;

  /** @ignore */
  rplannerDir: DataSpecificationsObject<'horizontal' | 'vertical' | 'north'>;

  /** @ignore */
  rplannerMotionSpeed: DataSpecificationsObject<RouteMotionSpeed>;

  /** @ignore */
  soundingIsSkewTlogP: DataSpecificationsObject<boolean>;

  /** @ignore */
  // soundingCondensationLevel: DataSpecificationsObject<'ccl' | 'lcl'>;

  /** @ignore */
  unresolvedErrors: DataSpecificationsObject<ShowableError[]>;

  /** @ignore */
  closedErrors: DataSpecificationsObject<string[]>;

  /** @ignore */
  showDailyNotifications: DataSpecificationsObject<boolean>;

  /** @ignore */
  appReviewPluginShown: DataSpecificationsObject<number | null>;

  /** @ignore */
  systemAppReviewDialogShown: DataSpecificationsObject<number | null>;

  /** @ignore */
  appReviewLastVersion: DataSpecificationsObject<string | null>;

  appReviewDialogLeaveForLater: DataSpecificationsObject<boolean>;

  skipAppReviewNecessaryConditions: DataSpecificationsObject<boolean>;

  /**
   * Favourite overlays on mobile devices
   * @ignore
   */
  favOverlaysMobile: DataSpecificationsObject<Overlays[]>;

  /**
   * Favourite overlays on desktop devices
   * @ignore
   */
  favOverlaysDesktop: DataSpecificationsObject<Overlays[]>;

  /**
   * Favorite POIs on mobile devices
   */
  favPoisMobile: DataSpecificationsObject<Pois[]>;

  /**
   * Last selected filter in mobile menu
   */
  mobileMenuFilter: DataSpecificationsObject<MenuItems>;

  /**
   * Signals if user is currently online or offline, meaning that
   * he has real internet connection
   */
  connection: DataSpecificationsObject<boolean>;

  /**
   * How long should picker-mobile stay open after user interaction
   */
  pickerMobileTimeout: DataSpecificationsObject<PickerMobileTimeout>;

  /**
   * Selected area and layers for offline mode
   * @ignore
   */
  offlineSetting: DataSpecificationsObject<OfflineConfiguration | null>;

  /**
   * Endable/dissable change of detail location, when map is dragged
   */
  changeDetailOnMapDrag: DataSpecificationsObject<boolean>;

  /**
   * Simple, easy to use indicator, if we are running in offline mode
   * @ignore
   */
  offlineMode: DataSpecificationsObject<boolean>;

  /**
   * Imfo about offline data residing in serviceWorker
   * @ignore
   */
  offlineDataInfo: DataSpecificationsObject<DownloadedInfo | null>;

  /**
   * Enables/disables offline mode at all. If false, offline mode is not available
   * and serviceWorker is not installed at all
   * @ignore
   */
  offlineModeEnabled: DataSpecificationsObject<boolean>;

  /**
   * Display this type of WX stations on POI map
   * @ignore
   */
  displayAdStations: DataSpecificationsObject<boolean>;

  /** @ignore */
  displayWMOStations: DataSpecificationsObject<boolean>;

  /** @ignore */
  displayMadisPWStations: DataSpecificationsObject<boolean>;

  /** @ignore */
  displayShipStations: DataSpecificationsObject<boolean>;

  /**
   * List of products that users do NOT want to see in the weather station
   * compare mode
   */
  stationCompareHiddenProducts: DataSpecificationsObject<PointProducts[]>;

  /**
   * Main GSPR, privacy or cookie consent object
   * @ignore
   */
  consent: DataSpecificationsObject<Consent | null>;

  /**
   * Youtube cookie consent object
   * @ignore
   */
  youtubeConsent: DataSpecificationsObject<Omit<Consent, 'analytics'> | null>;

  /**
   * Twitter cookie consent object
   * @ignore
   */
  twitterConsent: DataSpecificationsObject<Omit<Consent, 'analytics'> | null>;

  /**
   * Counter to synchronize Client and native backup data
   */
  appLocalStorageCounter: DataSpecificationsObject<number | null>;

  /**
   * List of installed external plugins
   * @ignore
   */
  installedPlugins: DataSpecificationsObject<InstalledExternalPluginConfig[]>;

  /*
   * User has entered into arrange mode in RH menu
   */
  rhMenuArrangeMode: DataSpecificationsObject<boolean>;
}

/**
 * It picks all properties from DS which extends type passed to U parameter.
 * Strict means the extension has to be from both sides.
 *
 * @example
 * PickDataSpecificationPropsByType<Calendar> = {}; // because it is strict, and all Calendar properties can be also `null`
 * PickDataSpecificationPropsByType<Calendar, false> = { calendar: ..., radarCalendar: ..., satelliteCalendar: ... }
 */
export type PickDataSpecificationPropsByType<U, Strict = true> = Pick<
  DataSpecifications,
  {
    [P in keyof DataSpecifications]: Strict extends true
      ? DataSpecifications[P]['def'] extends U
        ? U extends DataSpecifications[P]['def']
          ? P
          : never
        : never
      : U extends DataSpecifications[P]['def']
      ? P
      : never;
  }[keyof DataSpecifications]
>;
