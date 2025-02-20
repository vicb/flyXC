import { IDB } from '@windy/IDB';
import type { Fav } from '@windy/favs.d';
import type { SearchRecent } from '@plugins/search/search';
import type { AlertResponse, AlertRequest } from '@windy/alerts';
import type { MarkedNotams } from '@plugins/airport/airport';
import type { MinifestObject } from '@windy/Calendar.d';
import type { SeenArticle } from '@windy/startup.d';
import type { PromoInfoObject } from '@windy/promo';
import type { AnyColorIdent, UserColor } from '@windy/Color.d';
export declare const initPromise: Promise<IDBDatabase>;
/** Db of stored user favourites */
export declare const userFavsIdb: IDB<
  string,
  Fav,
  import('../../types/interfaces').LatLon & {
    title: string;
  } & (
      | {
          type: 'fav';
        }
      | {
          type: 'alert';
          alert: import('../../types/interfaces').Alert;
          alertProps: import('../../types/interfaces').AlertProps;
        }
      | {
          type: 'airport';
          icao: string;
        }
      | {
          type: 'station';
          stationId:
            | `radiation-${string}`
            | `airq-${string}`
            | `ad-${string}`
            | `wmo-${string}`
            | `madis-${string}`
            | `buoy-${string}`
            | `dbuoy-${string}`
            | `pws-${string}`
            | `ship-${string}`;
        }
      | {
          type: 'webcam';
          webcamId: number;
        }
      | {
          type: 'route';
          route:
            | `car/${string}`
            | `vfr/${string}`
            | `ifr/${string}`
            | `elevation/${string}`
            | `boat/${string}`
            | `airgram/${string}`;
        }
    )
>;
export declare const searchRecentsIdb: IDB<string, SearchRecent, SearchRecent>;
/** Db of stored user alerts */
export declare const userAlertsIdb: IDB<string, AlertResponse, AlertRequest>;
/** Db of stored notams marked as read */
export declare const markedNotamsIdb: IDB<`${string}_${string}/${string}`, MarkedNotams, MarkedNotams>;
/** Latest used minifests */
export declare const minifestsIdb: IDB<string, MinifestObject, MinifestObject>;
/** Seen articles */
export declare const seenArticlesIdb: IDB<string, SeenArticle, SeenArticle>;
/** Seen promos */
export declare const seenPromosIdb: IDB<string, PromoInfoObject, PromoInfoObject>;
/** Custom user colors  */
export declare const customColorsIdb: IDB<AnyColorIdent, UserColor, UserColor>;
