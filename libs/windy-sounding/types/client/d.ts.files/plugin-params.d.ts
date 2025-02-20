import { Fav, FavId } from '@windy/favs.d';
import { StartupArticleData, WhatsNewData } from '@windy/startup.d';
import { HiddenReasonType, ReasonTypes } from '@plugins/subscription/subscription';
import { FullRenderParameters } from '@windy/Layer.d';
import { HttpPayload } from '@windy/http.d';
import {
  CapAlertHeadline,
  GeolocationInfo,
  HomeLocation,
  LatLon,
  PickerCoords,
  SummaryDataHash,
  WeatherDataPayload,
} from '@windy/interfaces.d';
import { Pois, Products } from '@windy/rootScope.d';
import { SingleClickParams } from '@windy/singleclick.d';
import { DetailDisplayType, RouteType, StationOrPoiType, ExternalPluginIdent, type Timestamp } from '@windy/types.d';
import { WebcamCategoryType } from '@windy/webcams';

/**
 * Type of source event, that led to opening any plugin
 */
export type PluginOpenEventSource =
  | 'contextmenu'
  | 'hp'
  | 'url'
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
  | 'other'
  | 'label';

export interface PluginSource {
  source?: PluginOpenEventSource;
  poiType?: StationOrPoiType | Pois | 'stations';
}

export interface DetailOpenParams extends PluginSource, LatLon {
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
   * Detail was opened by clicking on Alert notification so detail table should be scrolled to
   * particular timestamp
   */
  moveToTimestamp?: boolean;

  /**
   * Array of timestamp, when Alert was triggered
   */
  timestamps?: Timestamp[] | null;
}

type WebcamDetailOpenParams =
  | (PluginSource & {
      id: number | string;
    })
  | undefined;

type RplannerDistanceParams =
  | { view: RouteType; coords: string; id: FavId; isFav: true } // Opening from favourites
  | { view?: RouteType; coords: string; id?: string } // Opening from URL
  | Fav
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
  favs: PluginSource & { importObsoleteFavs?: boolean };
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
        promote?: ReasonTypes | HiddenReasonType;
        pendingError?: Error & { responseText: string };
      })
    | undefined;
  'alerts-edit': PluginSource &
    (
      | { action: 'edit'; id: string }
      | { action: 'migration'; favId: string }
      | {
          action: 'new';
          lat: number;
          lon: number;
          locationName?: string;
        }
    );
  alerts: PluginSource & {
    message?: string;
  };
  distance: PluginSource & RplannerDistanceParams;
  rplanner: PluginSource & RplannerDistanceParams;
  airport: PluginSource & { id: string };
  share: undefined;
  'nearest-stations': PluginSource & LatLon & { compactVersion?: boolean; includeAirq?: boolean };
  'nearest-airq': PluginSource & LatLon;
  'nearest-webcams-mobile': PluginSource & LatLon;
  'nearest-webcams': PluginSource & LatLon;
  'external-plugins': (PluginSource & { id?: string; qs?: PluginsQsParams['external-plugins'] }) | undefined;
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
  'location-permission':
    | (PluginSource & {
        resolve?: (value: boolean | PromiseLike<boolean>) => void;
      })
    | undefined;
  'developer-mode': (PluginSource & { qs: Record<string, string> | undefined }) | undefined;
  'windy-external-plugin': PluginSource & LatLon;
  menu: PluginSource & { scrollTo?: 'pois' };
  onboarding: (PluginSource & { getUserInterests?: boolean }) | undefined;
  'heatmaps-redirect': PluginSource & { id?: string };
} & {
  [external: ExternalPluginIdent]:
    | (PluginSource & { query: Record<string, string> | undefined })
    | (PluginSource & LatLon)
    | undefined;
} & { [others: string]: undefined };

export type PluginsQsParams = {
  'external-plugins': Record<string, string> | undefined;
  'developer-mode': Record<string, string> | undefined;
  detail: { hrTimestamps?: string; name?: string; moveToTimestamp?: string };
} & { [others: string]: undefined };
