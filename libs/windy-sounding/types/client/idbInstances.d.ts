import { IDB } from '@windy/IDB';
import type { MarkedNotams } from '@plugins/airport/airport';
import type { SearchRecent } from '@plugins/search/search';
import type { AnyColorIdent, UserColor } from '@windy/Color.d';
import type { AlertRequest, AlertResponse } from '@windy/alerts';
import type { Fav, FavFragment } from '@windy/favs.d';
import type { CapAlertSlided, InstalledExternalPluginConfig } from '@windy/interfaces';
import type { PromoInfoObject } from '@windy/promo';
import type { SeenArticle, SeenStory } from '@windy/startup.d';
export declare const initPromise: Promise<IDBDatabase>;
/** Db of stored user favourites */
export declare const userFavsIdb: IDB<string, Fav, FavFragment>;
export declare const searchRecentsIdb: IDB<string, SearchRecent, SearchRecent>;
/** Db of stored user alerts */
export declare const userAlertsIdb: IDB<string, AlertResponse, AlertRequest>;
/** Db of stored notams marked as read */
export declare const markedNotamsIdb: IDB<`${string}_${string}/${string}`, MarkedNotams, MarkedNotams>;
/** Seen articles */
export declare const seenArticlesIdb: IDB<string | number, SeenArticle, SeenArticle>;
/** Seen promos */
export declare const seenPromosIdb: IDB<string, PromoInfoObject, PromoInfoObject>;
/** Custom user colors  */
export declare const customColorsIdb: IDB<AnyColorIdent, UserColor, UserColor>;
/** Cap alerts that were slided from left to right on startup screen */
export declare const slidedCapAlertsIdb: IDB<string, CapAlertSlided, CapAlertSlided>;
/** Seen stories */
export declare const seenStoriesIdb: IDB<string, SeenStory, SeenStory>;
/** Log of pages & events that happened on this device */
export declare const logIdb: IDB<
  | `airport/${string}`
  | `articles/${string}`
  | `garmin/${string}`
  | `onboarding/${string}`
  | `station/${string}`
  | `subscription/${string}`
  | `pois/${string}`
  | `version/${string}`
  | `overlay/${string}`
  | `level/${string}`
  | `acRange/${string}`
  | `path/${string}`
  | `isolinesType/${string}`
  | `isolinesOn/${string}`
  | `product/${string}`
  | `plugin/${string}`
  | `startup/${string}`
  | `404/${string}`
  | `promo/${string}`
  | `appRating/${string}`
  | `appOpening/${string}`
  | `detail2/${string}`
  | `appsflyer/${string}`
  | `weather/${string}`
  | `events/${string}`
  | `locationPermissionPopup/${string}`
  | `widgetPromo/${string}`
  | `storyEvent/${string}`,
  number,
  number
>;
/** Log of locations, that user uses on this device */
export declare const popularLocationsIdb: IDB<string, number, number>;
/** Seen stories */
export declare const likedStoryCommentsIdb: IDB<string, boolean, boolean>;
/** Installed external plugins  */
export declare const installedPluginsIdb: IDB<
  `windy-plugin-${string}`,
  InstalledExternalPluginConfig,
  InstalledExternalPluginConfig
>;
export declare const clearIndexedDB: () => Promise<void>;
