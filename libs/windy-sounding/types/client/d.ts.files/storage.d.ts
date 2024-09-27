import { MinifestObject } from '@windy/Calendar.d';
import { Fav, LastSentDevice, SavedFav, SeenArticle } from '@windy/interfaces.d';
import { StoredTransFile } from '@windy/trans.d';
import { Timestamp } from '@windy/types.d';

import LRUCache from './lruCache';

export interface StorageData {
  /**
   * Number of hits for every single promo2 id.
   */
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

  lastSentDevice?: LastSentDevice;

  /**
   * Articles, user has seen on particular device
   */
  articles?: Record<string, SeenArticle>;

  /**
   * Airport detail offline cache
   */
  'offline/airport'?: ReturnType<LRUCache<string>['toJSON']>;

  /**
   * Used by dev plugin for plugins development
   */
  pluginsDev?: { url: string; consent: boolean };

  version?: string;

  // TODO - centralize all these template strings to the logic directly in their modules

  [key: `settings_${string}_ts`]: Timestamp | null;

  [key: `lang/${string}.json`]: StoredTransFile | null;

  [key: `favs${number}`]: Record<string, SavedFav> | null;

  // TODO - remove this
  [key: `favs${number}_overflowed`]: Record<string, SavedFav> | null;

  [key: `favs${number}_ts`]: Timestamp | null;

  [key: `recents${number}`]: Record<string, Fav> | null;

  [key: `lastMinifest/${string}`]: MinifestObject | null;

  /**
   * Other dynamically add storage data
   */
  [ident: string]: unknown | null;
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
