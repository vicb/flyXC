import {
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
import { LevelsRange } from '@windy/types.d';

import { Consent, DetailExtendedLatLon, GeolocationInfo, HomeLocation, LatLon } from '@windy/interfaces.d';

import {
  MenuItems,
  PickerMobileTimeout,
  ShowableError,
  SubTier,
  Timestamp,
  Hours,
  RouteMotionSpeed,
  UsedMapLibrary,
  UserInterest,
  DefaultPointModel,
  type ISOCountryCode,
  type AnimationSpeed,
  type DetailDisplayType,
} from '@windy/types.d';

import { MetricItem } from '@windy/Metric.d';

import type { LoginAndFinishAction, User } from '@windy/user.d';

import type { SubscriptionInfo } from '@plugins/shared/subscription-services/subscription-services.d';
import type RadarCalendar from '@plugins/radar-plus/calendar/radarCalendar';
import type { SatelliteCalendar } from '@plugins/radar-plus/calendar/satelliteCalendar';
import type { NumberRange } from '@windy/alerts.d';
import type { FavType } from '@windy/favs.d';
import type { Range } from '@plugins/shared/radSatGui/context';
import type { TiledPoiClasses } from '@plugins/poi-libs/poi-libs.d';

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
  preferredNotificationTime?: NumberRange[];
  frequencyDays?: number;
  usedTimezoneName?: string;
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
  cc?: ISOCountryCode;
  name: string;
  nameValid?: boolean;
}

export interface Donation {
  ts: Timestamp;
  amount: number;
  sub: string;
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
   * Persistent item. Save this item to localStorage
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
   * Setter function (will be run before value is set)
   */
  syncSet?: (...args: unknown[]) => T;

  /**
   * Setter function - asynchronous (will be run before value is set)
   */
  asyncSet?: (...args: unknown[]) => Promise<T>;

  /**
   * This item can be set only by syncSet or asyncSet (so basically it is derived store)
   * This so far does not do anything, it's merely a flag for developer
   */
  readOnly?: boolean;

  /**
   * This item can be used by Premium only users. Free users get always default value,
   * so additional checks before using store.get('item') are not necessary.
   */
  premiumOnly?: boolean;
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
   * Rain/snow/wind accumulations time range in hours
   */
  acRange: DataSpecificationsObject<Hours>;

  /**
   * Selected flight level range for levels-range overlays (e.g. 'surface-700h', '700h-500h')
   */
  levelsRange: DataSpecificationsObject<LevelsRange>;

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
   * Which type of isolines to render
   */
  isolinesType: DataSpecificationsObject<Isolines>;

  /**
   * Whether to render isolines
   */
  isolinesOn: DataSpecificationsObject<boolean>;

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
   * Global fallback product that handles situation
   * when user pans the map out of bounds of local
   * model. Preferred model must have also second wave
   * mode like 'ecmwf' 👉🏻 'ecmwfWaves'
   */
  preferredProduct: DataSpecificationsObject<'mblue' | 'ecmwf' | 'gfs' | 'icon' | 'iconEu'>;

  /**
   * If timeline animation is running
   */
  animation: DataSpecificationsObject<boolean>;

  /**
   * Animation playback speed (normal = legacy speed)
   */
  animationSpeed: DataSpecificationsObject<AnimationSpeed>;

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
   * Display graticule over the map
   */
  graticule: DataSpecificationsObject<boolean>;

  /**
   * Display lat/lon on picker
   */
  latlon: DataSpecificationsObject<boolean>;

  /**
   * Display altitude on picker
   */
  showPickerElevation: DataSpecificationsObject<boolean>;

  /**
   * Whether picker is being dragged
   */
  pickerDragging: DataSpecificationsObject<boolean>;

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
   * Consent to receive newsletter
   */
  marketingConsent: DataSpecificationsObject<boolean>;

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
  country: DataSpecificationsObject<ISOCountryCode | 'xx'>;

  /**
   * Default units setting (computed on the first visit based on GeoIP)
   */
  defaultUnits: DataSpecificationsObject<'unset' | 'imperial' | 'metric'>;

  /**
   * Type of map tiles map shown in detail
   */
  map: DataSpecificationsObject<'sznmap' | 'sat' | 'winter'>;

  /**
   * Which type of map library is used
   */
  mapLibrary: DataSpecificationsObject<UsedMapLibrary>;

  /**
   * Show 7 days weather on startup
   */
  showWeather: DataSpecificationsObject<boolean>;

  stormSettingsLightning: DataSpecificationsObject<boolean>;

  /**
   * Finally used language (the one which is successfully loaded in trans module)
   */
  usedLang: DataSpecificationsObject<SupportedLanguages>;

  /**
   * The difference in minutes between UTC and the local time on the device.
   */
  lastTimezoneOffset: DataSpecificationsObject<number>;

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
   * User selected default zoom
   */
  startUpZoom: DataSpecificationsObject<number | null>;

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
   * Display Airspaces map layer in the METARs POI layer
   */
  displayAirspaces: DataSpecificationsObject<boolean>;

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
   * User has dismissed the "live alerts only work on mobile app" banner in the alerts list
   */
  liveAlertsWarningDismissed: DataSpecificationsObject<boolean>;

  /**
   * Detail's location - TODO: get rid of async name property
   * @ignore
   */
  detailLocation: DataSpecificationsObject<DetailExtendedLatLon | null>;

  /**
   * 1h step of forecast
   */
  detailDefault1h: DataSpecificationsObject<boolean>;

  /**
   * Detail keeps its 10+ days expanded forecast
   */
  detailDefaultExtended: DataSpecificationsObject<boolean>;

  /**
   * Whether to use saved default display and product when opening detail
   */
  detailDefaultEnabled: DataSpecificationsObject<boolean>;

  /**
   * Default detail display type (table, meteogram, waves, etc.)
   */
  detailDefaultDisplay: DataSpecificationsObject<DetailDisplayType>;

  /**
   * Default detail product/model (mblue, ecmwf, etc.) or null for auto
   */
  detailDefaultProduct: DataSpecificationsObject<PointProducts | null>;

  /**
   * Indicates, that deail plugin will remember last selected 1h/3h or extended forecast
   */
  detailRememberLast: DataSpecificationsObject<boolean>;

  /**
   * Enable/disable synchronization of forecast time with map timestamp on mobile
   */
  detailSyncTimeWithMap: DataSpecificationsObject<boolean>;

  /**
   * Whether to DEBUG detail related stuff
   */
  detailDebugMode: DataSpecificationsObject<boolean>;

  /**
   * display webcams on daylight
   */
  webcamsDaylight: DataSpecificationsObject<boolean>;

  /**
   * display previews of webcams on the map
   */
  camsPreviews: DataSpecificationsObject<boolean>;

  /**
   * Today, tomorrow, later
   */
  capDisplay: DataSpecificationsObject<'all' | 'today' | 'tomm' | 'later'>;

  /**
   * Timestamp in ms
   */
  radarTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Radar calendar
   */
  radarCalendar: DataSpecificationsObject<RadarCalendar | null>;

  /**
   * Visible lightning data on radar
   */
  blitzOn: DataSpecificationsObject<boolean>;

  /**
   * Sound for lightning flash effect on radar
   */
  blitzSoundOn: DataSpecificationsObject<boolean>;

  /**
   * Whether to render baseLayer using tiles with thick borders
   */
  showThickBorders: DataSpecificationsObject<boolean>;

  /**
   * Timestamp in ms
   */
  satelliteTimestamp: DataSpecificationsObject<Timestamp>;

  /**
   * Satellite calendar
   */
  satelliteCalendar: DataSpecificationsObject<SatelliteCalendar | null>;

  /**
   * Timestamp when last satellite outage message was displayed. Used to avoid spamming user with messages.
   */
  satelliteLastOutageMessageTs: DataSpecificationsObject<Timestamp | null>;

  /**
   * Interpolate images using vectors
   */
  radSatFlowOn: DataSpecificationsObject<boolean>;

  /**
   * Render precipitation type pattern on radar
   */
  radarRenderPType: DataSpecificationsObject<boolean>;

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
   * For every "POI group" (empty POI with sub-POIs) it stores which
   * sub-POI was previously selected.
   */
  subPois: DataSpecificationsObject<Partial<Record<Pois, Pois>>>;

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
   * Sorting of nearest weather stations
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
   * Webcam or station last location (used for globe picker initial location)
   * @ignore
   */
  lastPoiLocation: DataSpecificationsObject<(LatLon & { type?: string }) | null>;

  /**
   * Picker last location, to be consumed by location service to enhance URL
   * Used only on desktop device
   */
  pickerLocation: DataSpecificationsObject<LatLon | null>;

  /**
   * Latest maps/globe coordinates
   * @ignore
   */
  mapCoords: DataSpecificationsObject<MapCoordinates | null>;

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
   * Enable/disable change of detail location, when map is dragged
   */
  changeDetailOnMapDrag: DataSpecificationsObject<boolean>;

  /**
   * Timestamp in ms
   */
  radsatTimestamp: DataSpecificationsObject<Timestamp>;

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
   * Main GDPR, privacy or cookie consent object
   * @ignore
   */
  consent: DataSpecificationsObject<Consent | null>;

  /**
   * Is analytics consent required
   * @ignore
   */
  analyticsConsentRequired: DataSpecificationsObject<boolean | null>;

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

  /*
   * User has entered into arrange mode in RH menu
   */
  rhMenuArrangeMode: DataSpecificationsObject<boolean>;

  /**
   * List of interests user has, based on onboarding picker
   */
  userInterests: DataSpecificationsObject<UserInterest[]>;

  onboardingFinished: DataSpecificationsObject<boolean>;

  locationPermissionsGranted: DataSpecificationsObject<boolean>;

  doNotShowLocationPermissionsPopup: DataSpecificationsObject<boolean>;

  locationPermissionsPopupShown: DataSpecificationsObject<number | null>;

  loginAndFinishAction: DataSpecificationsObject<(LoginAndFinishAction & { updated: Timestamp }) | null>;

  /**
   * If user wants to display just some type of favs in favs plugin
   */
  favsFilter: DataSpecificationsObject<FavType[]>;

  /**
   * Contains information, that registration hash for pushNotifications has been
   * successfully sent to the backend
   */
  pushNotificationsReady: DataSpecificationsObject<boolean>;

  /**
   * Whenever fullscreen plugin is opened on mobile device suspend potential
   * sound & haptic feedback on radar/sat layers
   */
  suspendSoundAndHaptic: DataSpecificationsObject<boolean>;

  /**
   * User has enabled advanced features in debug console
   */
  advancedDebugConsole: DataSpecificationsObject<boolean>;

  /**
   * Active tab in pin menu (fav-layers plugin)
   */
  pinMenuActiveTab: DataSpecificationsObject<'models' | 'layers'>;

  /*
   * Range of the currently used segment
   */
  radarPlusSegmentRange: DataSpecificationsObject<Range>;

  /**
   * Whether the debug performance overlay (frametimes & FPS) is enabled (DEBUG type setting)
   */
  perfOverlayEnabled: DataSpecificationsObject<boolean>;

  /*
   * Instance of TIlePoi, that is used to display POIs
   */
  tiledPoiLayer: DataSpecificationsObject<TiledPoiClasses | null>;

  /**
   * Whether to multisample pType composite when rendering pType (to smooth-out transition between precipitation categories)
   */
  pTypeMultiSampled: DataSpecificationsObject<boolean>;

  /**
   * Whether to DEBUG airport related stuff
   */
  airportDebugMode: DataSpecificationsObject<boolean>;

  /**
   * Determines, that showMyPosition (i.e. user position marker) is active
   */
  showMyPosition: DataSpecificationsObject<boolean>;

  /**
   * Contains value of search input element
   */
  searchInputValue: DataSpecificationsObject<string>;

  /**
   * Determines whether to show or hide search input loader
   */
  searchInputLoading: DataSpecificationsObject<boolean>;

  /**
   * Determines forecast model used to render sounding.
   * This must be separate from main product, since sounding supports Meteoblue,
   * but Meteoblue cannot be rendered into the main map, since it lacks global forecast.
   */
  soundingProduct: DataSpecificationsObject<Products>;

  /**
   * Point forecast models, that are pinned to top in multimodel
   */
  multimodelPinnedModels: DataSpecificationsObject<PointProducts[]>;

  /**
   * Point forecast models, that are blocked in multimodel
   */
  multimodelBlockedModels: DataSpecificationsObject<PointProducts[]>;

  /**
   * Defaul point forecast model or null. Nell menas user did not choose default model and yet
   */
  userSelectedPointFcstModel: DataSpecificationsObject<DefaultPointModel | null>;
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
