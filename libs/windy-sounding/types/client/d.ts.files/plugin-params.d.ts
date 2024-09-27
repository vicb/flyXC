import { OpenOptions } from '@capacitor/browser';
import { ProviderConstructorParams } from '@plugins/_shared/subscription-services/subscription-services.d';
import { FavEventTypes } from '@plugins/favs/favs.d';
import { StartupArticleData, WhatsNewData } from '@plugins/startup/startup.d';
import { HiddenReasonType, ReasonTypes } from '@plugins/subscription/subscription';
import { FullRenderParameters } from '@windy/Layer.d';
import { HttpPayload } from '@windy/http.d';
import {
  CapAlertHeadline,
  GeolocationInfo,
  HomeLocation,
  LatLon,
  PickerCoords,
  SavedAlertFav,
  SavedFav,
  SummaryDataHash,
  WeatherDataPayload,
} from '@windy/interfaces.d';
import { Pois, Products } from '@windy/rootScope.d';
import { SingleClickParams } from '@windy/singleclick.d';
import { DetailDisplayType, RouteType, StationOrPoiType, type ExternalPluginIdent } from '@windy/types.d';
import { WebcamCategoryType } from '@windy/webcams';

/**
 * Type of source event, that led to opening any plugin
 */
export type PluginOpenEventSource =
  | 'contextmenu'
  | 'hp'
  | 'url'
  | 'sigleclick'
  | 'poi-icon'
  | 'search'
  | 'detail'
  | 'singleclick'
  | 'favs-page'
  | 'favs-on-hp'
  | 'picker'
  | 'meta'
  | 'fallback'
  | 'gps'
  | 'ip'
  | 'uploader'
  | 'api'
  | 'last'
  | 'back-button'
  | 'label';

export interface PluginSource {
  source?: PluginOpenEventSource;
  poiType?: StationOrPoiType | Pois | 'stations';
}

interface DetailOpenParams extends PluginSource, LatLon {
  /**
   * How to display detail
   */
  display?: DetailDisplayType;

  /**
   * Product to open
   */
  product?: Products;

  /**
   * Name of locality
   */
  name?: string;

  /**
   * ID of POI icon that was clicked to open detail
   */
  id?: string;

  /**
   * If detail is opened by clicking on label
   */
  sourceEl?: HTMLElement;

  /**
   * Detail was opened by clicking on Alert neotification so detail table should be scrolled to
   * particular timestamp
   */
  moveToTimestamp?: boolean;

  /**
   * Array of times, when Alert was triggered in a form of 897987987,098908089,09809098
   * where numbers are timestamps / tsHour
   */
  hrTimestamps?: string;
}

type WebcamDetailOpenParams =
  | (PluginSource & {
      id: number | string;
    })
  | undefined;

type RplannerDistanceParams =
  | { view?: RouteType; coords: string; id?: string } // Opening from URL
  | SavedFav
  // | RplannerOpeningAsFavs // Clicking on route stored as fav
  | LatLon[] // User puts two airports is search bar
  | (LatLon & {
      source: 'contextmenu';
    }) // Click with RH mouse and activate from contextmenu
  | {
      import: boolean;
      content: string;
    }; // Uploaded GPX

export type PickerOpenParams =
  | (PluginSource &
      PickerCoords & {
        noEmit?: boolean;
      })
  | SingleClickParams;

export type PluginsOpenParams = {
  detail: DetailOpenParams;
  picker: PickerOpenParams;
  'picker-mobile': PickerOpenParams;
  favs:
    | (PluginSource & {
        msg?: FavEventTypes;
      })
    | undefined;

  station: PluginSource & { id: string };
  multimodel: LatLon & PluginSource & { name?: string | null };
  webcams: (PluginSource & { category: WebcamCategoryType }) | undefined;
  'webcams-detail': PluginSource & WebcamDetailOpenParams;
  'webcams-edit': PluginSource & WebcamDetailOpenParams;
  'webcams-remove': PluginSource & WebcamDetailOpenParams;
  //settings: (PluginSource & { id: string }) | undefined;
  settings: PluginSource | undefined;
  articles: (PluginSource & { id: number | string }) | undefined;
  upload: PluginSource & { id: string };
  uploader: PluginSource & { id?: string };
  'cap-alert': PluginSource &
    LatLon & {
      /**
       * Name of locality
       */
      name?: string;
    };
  contextmenu: PluginSource & LatLon & { containerPoint?: L.Point };
  subscription:
    | (PluginSource & {
        fscNext?: string;
        promote?: ReasonTypes | HiddenReasonType;
        pendingError?: Error & { responseText: string };
      })
    | undefined;
  alerts:
    | (PluginSource & {
        id?: string;
        name?: string;
        title?: string;
        action?: 'new';
        lat?: string | number;
        lon?: string | number;
      })
    | (PluginSource & SavedAlertFav);
  distance: PluginSource & RplannerDistanceParams;
  rplanner: PluginSource & RplannerDistanceParams;
  airport: PluginSource & {
    // Airport plugin can receive ICAO code as id || icao property
    icao?: string;
    id?: string;
  };
  'save-password': PluginSource & {
    username: string;
    password: string;
  };
  share: undefined;
  'nearest-stations': PluginSource & LatLon & { compactVersion?: boolean; includeAirq?: boolean };
  'nearest-airq': PluginSource & LatLon;
  'nearest-webcams-mobile': PluginSource & LatLon;
  'nearest-webcams': PluginSource & LatLon;
  'external-plugins': (PluginSource & { id?: string; qs?: PluginsQsParams['external-plugins'] }) | undefined;
  browser: PluginSource & {
    options: OpenOptions;
    onFinished?: () => void;
  };
  sounding: PluginSource & LatLon & { name?: string };
  radiosonde: PluginSource & { id: string; lat?: number; lon?: number };
  startup: PluginSource;
  'startup-whats-new': PluginSource & { data: WhatsNewData };
  'startup-articles': PluginSource & { data: StartupArticleData[] };
  'startup-weather': PluginSource & {
    coords: HomeLocation | GeolocationInfo;
    promises: {
      wx: Promise<HttpPayload<WeatherDataPayload<SummaryDataHash>>>;
      capAlerts: Promise<HttpPayload<CapAlertHeadline[]>>;
    };
  };
  login:
    | (PluginSource & {
        reason?: 'login' | 'register';
      })
    | undefined;
  isolines: PluginSource & FullRenderParameters;
  screenshot: (PluginSource & { params?: string }) | undefined;
  hurricanes: (PluginSource & { id: string }) | undefined;
  'app-review-dialog':
    | (PluginSource & {
        sessionsPerDay?: number;
        showSystemDialog?: boolean;
      })
    | undefined;
  offline: PluginSource;
  'developer-mode': (PluginSource & { qs: Record<string, string> | undefined }) | undefined;
  'windy-external-plugin': PluginSource & LatLon;
  menu: PluginSource; // FIXME: This typing is not correct. Poi selector on HP is calling menu with string 'pois'
} & {
  [external: ExternalPluginIdent]:
    | (PluginSource & { query: Record<string, string> | undefined })
    | (PluginSource & LatLon)
    | undefined;
} & { [others: string]: undefined };

export type PluginsQsParams = {
  subscription: ProviderConstructorParams | undefined;
  'external-plugins': Record<string, string> | undefined;
  'developer-mode': Record<string, string> | undefined;
  detail: { hrTimestamps?: string; name?: string; moveToTimestamp?: string };
} & { [others: string]: undefined };
