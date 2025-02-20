import { Timestamp } from '@windy/types.d';
import { Fav, type ObsoleteFav } from '@windy/favs.d';
import { SearchRecent } from '@plugins/search/search';

export interface StorageData {
  /** @deprecated  replaced by IDB */
  promos2?: Record<string, number>;

  /**
   * Temp value ensures user stayed logged with an old authHash during Cordova -> Capacitor migration
   */
  authHash?: string;

  /**
   * Timestamp of last pushing settings to cloud
   */
  storedSettings?: number;

  /**
   * Timestamp of last pulling settings from cloud
   */
  lastSyncableUpdatedItem?: number;

  UUID?: string;

  webGLtest3?: { status: string; ua: string };

  /**
   * Timestamp when rating dialog was shown last time
   */
  rateDialogShown?: Timestamp;

  /**
   * Used by dev plugin for plugins development
   */
  pluginsDev?: { url: string; consent: boolean };

  version?: string;

  [key: `settings_${string}_ts`]: Timestamp | null;

  /**
   * Other dynamically add storage data
   */
  [ident: string]: unknown | null;

  /** @deprecated & replaced by IDB */
  [key: `recents${number}`]: Record<string, SearchRecent> | null;

  /** @deprecated & replaced by IDB */
  [key: `favs${number}`]: Record<string, Fav | ObsoleteFav> | null;

  /** @deprecated & replaced by IDB */
  [key: `favs${number}_ts`]: Timestamp | null;
}

export type StorageDataKey = keyof StorageData & string;

export interface Storage {
  /**
   * Is storage available or not?
   */
  isAvbl: boolean;

  /**
   * Put items to the storage, using `JSON.strigify` to serialize the data
   *
   * @param key Key
   * @param object object
   * @returns
   */
  put: <T extends StorageDataKey>(key: T, object: StorageData[T]) => void;

  /**
   * Test existence of an item
   *
   * @param key Key
   * @returns True if key is presented
   */
  hasKey: <T extends StorageDataKey>(key: T) => boolean;

  /**
   * Get item from storage, using `JSON.parse` to deserialize the data
   *
   * @param key Key
   * @returns Data
   */
  get: <T extends StorageDataKey>(key: T) => StorageData[T] | null;

  /**
   * Removes item from a storage
   *
   * @param key Key
   * @returns
   */
  remove: <T extends StorageDataKey>(key: T) => void;
}
