import { Fav, FavId } from '@windy/favs.d';

import { HttpPayload } from '@windy/http.d';
import {
    CapAlertHeadline,
    GeolocationInfo,
    HomeLocation,
    LatLon,
    PickerCoords,
    FullRenderParameters,
} from '@windy/interfaces.d';
import { Pois, PointProducts } from '@windy/rootScope.d';
import { SingleClickParams } from '@windy/singleclick.d';
import {
    DetailDisplayType,
    RouteType,
    StationOrPoiType,
    ExternalPluginIdent,
    type Timestamp,
} from '@windy/types.d';
import { WebcamCategoryType } from '@windy/webcams';
import type { Point, GeoJsonObject } from '@leafletGl';

import type { StationDisplayType } from '@plugins/station/station';
import type { LiveAlertEvent } from '@plugins/startup-live-alerts/startup-live-alerts';
import type { ArticlePromoData, ArticleStartupData } from '@plugins/articles/articles.d';
import type {
    FragmentDataPayload,
    WeatherDataPayload2,
    AllPossibleDataHashes2,
} from '@windy/node-forecast-v3.d';
import type {
    HiddenReasonType,
    ReasonTypes,
    SubscriptionSource,
} from '@plugins/subscription/subscription';
import type { AvalancheRisk } from '@plugins/shared/avalanche/avalanche';

/**
 * Type of source event, that led to opening any plugin
 */
export type PluginOpenEventSource =
    | 'contextmenu'
    | 'beta-drop-down'
    | 'hp'
    | 'url'
    | 'singleclick'
    | 'poi-icon'
    | 'search'
    | 'detail'
    | 'favs-page'
    | 'alerts-page'
    | 'favs-on-hp'
    | 'picker'
    | 'picker-mobile'
    | 'picker-mobile-settings'
    | 'meta'
    | 'fallback'
    | 'gps'
    | 'ip'
    | 'uploader'
    | 'api'
    | 'last'
    | 'back-button'
    | 'other'
    | 'label'
    | `promo-${string}`
    | 'default-model-selector';

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
    product?: PointProducts;

    /**
     * Name of locality
     */
    name?: string;

    /**
     * ID of POI icon that was clicked to open detail
     */
    id?: string;

    /**
     * Detail should be scrolled to this timestamp
     */
    moveToTimestamp?: boolean;

    /**
     * Array of timestamp, when Alert was triggered
     */
    timestamps?: Timestamp[] | null;

    /**
     * Preloaded point forecast data promise, populated in beforeLoad
     * to start fetching data before the plugin module is loaded.
     * Includes the request params so consumer can validate the data matches.
     */
    preloadedData?: DetailPreloadedData;
}

export interface DetailPreloadedData {
    lat: number;
    lon: number;
    model: PointProducts;
    display: DetailDisplayType;
    promise: Promise<HttpPayload<WeatherDataPayload2<AllPossibleDataHashes2>>>;
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
      } // Uploaded GPX
    | {
          coords: string;
          speed: number;
      } // Opening from Wind Trajectories plugin by clicking on trajectory
    | undefined;

export type PickerOpenParams =
    | (PluginSource &
          PickerCoords & {
              noEmit?: boolean;
          })
    | SingleClickParams;

export type StartupWeatherPromises = {
    wx: Promise<HttpPayload<FragmentDataPayload>>;
    capAlerts: Promise<HttpPayload<CapAlertHeadline[]>>;
    liveAlertsPromise: Promise<
        HttpPayload<{
            alerts: LiveAlertEvent[];
        }>
    >;
    articlePromise: Promise<HttpPayload<ArticleStartupData>>;
    promoPromise: Promise<HttpPayload<ArticlePromoData>>;
};

export type PluginsOpenParams = {
    detail: DetailOpenParams;
    'default-model-selector': DetailOpenParams;
    picker: PickerOpenParams;
    'picker-mobile': PickerOpenParams;
    favs: PluginSource;
    station: PluginSource & {
        id: string;
        moveToTimestamp?: Timestamp;
        view?: StationDisplayType;
    };
    multimodel: LatLon & PluginSource & { name?: string | null };
    webcams: (PluginSource & { category: WebcamCategoryType }) | undefined;
    'webcams-detail': PluginSource & WebcamDetailOpenParams;
    settings: PluginSource | undefined;
    articles: (PluginSource & { id: number | string; autoOpened?: boolean }) | undefined;
    upload: PluginSource & { id: string };
    uploader: PluginSource & { id?: string };
    'cap-alerts-detail': PluginSource &
        LatLon & {
            /**
             * Name of locality
             */
            name?: string;
        };
    'avalanche-danger-detail': PluginSource & {
        regionId: string;
        geojson?: GeoJsonObject;
        avalancheRisk?: AvalancheRisk;
    };
    contextmenu: PluginSource & LatLon & { containerPoint?: Point };
    'beta-drop-down': undefined;

    /**
     * Typing is incorrect here. If called from ClickHandler it has a string as params
     */
    subscription:
        | PluginSource
        | (PluginSource &
              (
                  | { promote?: ReasonTypes | HiddenReasonType; subsSource: SubscriptionSource }
                  | { pendingError: Error & { responseText: string } }
              ));
    'alerts-edit': PluginSource &
        (
            | { action: 'edit'; id: string }
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
    'report-issue': PluginSource & { openedFrom?: 'radar' | 'satellite' | 'betaDropDown' | 'menu' };
    'sun-moon': (PluginSource & LatLon) | undefined;
    'wind-trajectories': (PluginSource & LatLon) | undefined;
    'nearest-stations': PluginSource & LatLon & { compactVersion?: boolean; includeAirq?: boolean };
    'nearest-webcams-mobile': PluginSource & LatLon;
    'nearest-webcams': PluginSource & LatLon;
    'external-plugins':
        | (PluginSource & { id?: string; qs?: PluginsQsParams['external-plugins'] })
        | undefined;
    sounding: PluginSource & LatLon & { name?: string };
    radiosonde: PluginSource & { id: string; lat?: number; lon?: number };
    'startup-articles': PluginSource & { data: ArticleStartupData };
    'startup-promos': PluginSource &
        (
            | {
                  typeOfPromo: 'obsoleteApp';
              }
            | { typeOfPromo: 'featured'; data: ArticlePromoData }
        );
    'startup-weather': PluginSource & {
        coords: HomeLocation | GeolocationInfo;
        promises: StartupWeatherPromises;
    };
    'startup-pin2hp': PluginSource;
    'startup-live-alerts': PluginSource & {
        coords: LatLon | GeolocationInfo | HomeLocation;
        alerts: LiveAlertEvent[];
    };
    'startup-debug': PluginSource & { id?: string };
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
    info: PluginSource & {
        displayOverlayInfoFirst?: boolean;
    };
    'search-my-location': GeolocationInfo;
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
