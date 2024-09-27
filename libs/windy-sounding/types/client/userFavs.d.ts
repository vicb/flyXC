import { Evented } from '@windy/Evented';
import { Favs } from '@windy/Favs';
import type { FavKey } from '@windy/Favs';
import type { Fav, LatLon, SavedFav, Alert } from '@windy/interfaces.d';
import type { Timestamp } from '@windy/types.d';
export type AlertCheckResult =
  | {
      status: 'missing';
      text: 'Alert not in DB';
    }
  | {
      alert: Alert & {
        suspended: true;
      };
    }
  | {
      status: 'ok';
      alert: Alert;
      timestamps: Timestamp[];
    };
interface FavsTypes {
  favsChanged: void;
  alertsChecked: number | void;
}
declare class SavedFavs extends Favs<SavedFav> {
  protected ident: 'favs2';
  private triggeredAlerts;
  /**
   * Supported types in this version
   */
  private types;
  private overflowedKey;
  on: Evented<FavsTypes>['on'];
  off: Evented<FavsTypes>['off'];
  emit: Evented<FavsTypes>['emit'];
  constructor();
  isValidFavourite(item: Fav): boolean;
  /**
   * Check if object is an alert (or near) and have triggered timestamps
   * item = latLonObj or alert id
   * returns list of timestamps if triggered
   */
  hasTimestamps<T extends LatLon | string>(item: T): number[] | null;
  /**
   * Add favorite
   */
  add(item: Fav): boolean | Promise<string>;
  /**
   * Search for an alert either by id or latLon
   */
  getAlert<T extends LatLon | string>(item: T): SavedFav | undefined;
  /**
   *
   * Return favs as array
   */
  getArray(deduped?: boolean, editedAlert?: Fav): SavedFav[];
  isFreeLimitExceeded(editedAlert?: Fav): boolean;
  /**
   * Emits info about favs status change
   */
  emitChange(): void;
  /**
   * Send updated fav to the server
   */
  updateFav(fav: Fav): Promise<void>;
  rename(fav: SavedFav, name: string): Promise<void>;
  remove(passedItem: Fav | FavKey, isAlert?: boolean): Promise<void>;
  /**
   * Check triggering of single alert (always resolve)
   */
  checkAlerts(param?: { newlyAddedId: string }): void;
  /**
   * Called upon inserting/deletion Display all favs on a map. This is VERY unefective method
   * that should keep client code small
   */
  onchange(): void;
  reset(): void;
  /**
   * get list of all overflowed deduplicated favs from store
   */
  getOverflowed(): SavedFav[];
  unstoreOverflowed(): void;
  resetOverflowed(): void;
  removeOverflowed(fav: Fav): void;
  /**
   * start to sync some overflowed
   */
  syncOverflowed(fav: Fav): void;
  /**
   * Toggle pinning fav to top or to homepage
   */
  togglePin(
    fav: SavedFav,
    whereToPin: 'pin2top' | 'pin2homepage',
    forcedTimestamp?: Timestamp,
  ): null | undefined | Timestamp;
  /**
   * Load from cloud
   */
  private loadFromCloud;
  /**
   * Alert related methods
   * item = fav || key
   */
  private setAlertProps;
  private createSyncError;
  private checkAlert;
  /**
   * Alerts were checked
   */
  private onAlertsChecked;
  /**
   * Check validity and store fav
   */
  private checkAndStore;
  /**
   * set an object as an overflowed favs if none are set already
   */
  private storeOverflowed;
  /**
   * add item as overflowed
   */
  private addOverflowed;
  private onUserData;
}
declare const _default: SavedFavs;
export default _default;
