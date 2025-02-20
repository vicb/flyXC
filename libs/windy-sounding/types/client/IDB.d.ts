import type { Timestamp } from '@windy/types.d';
/**
 * Allowed data types for storage
 */
export type DatabaseStore =
  | 'userFavs'
  | 'userAlerts'
  | 'customColors'
  | 'searchRecents'
  | 'markedNotams'
  | 'minifests'
  | 'seenArticles'
  | 'seenPromos';
export type BackendItem<V> = {
  updated: Timestamp;
  id: string;
  value: V;
};
export type BackendPayload<V> = BackendItem<V>[];
export type SupportedApiEndpoints = 'notams' | 'colors' | 'alerts' | 'favs';
export type StoredObjectWithId = {
  id: string;
};
export interface IDBParams {
  storeId: DatabaseStore;
  initPromise: Promise<IDBDatabase>;
  backendApiEndpoint?: SupportedApiEndpoints;
}
/**
 * Wrapper around IndexedDB to provide async storage
 *
 * Synchronization with backend database is also supported
 */
export declare class IDB<K extends string | number, V, W = V> {
  private storeId;
  private memoryCache;
  private cacheIsValid;
  private initPromise;
  /**
   * Is this db synced with backend?
   *
   * Storing to user backend is possible only for registered and properly logged in users
   * The check if user is logged in, must be dome outside of this class, preferably in GUI
   */
  private usesBackendSync;
  /**
   * URL of the API endpoint, where data should be stored
   */
  private apiEndpoint;
  /**
   * Timestamp of last db update on this device (used only when collection has userBackend)
   */
  private readonly lastTimeUpdatedKey;
  constructor(params: IDBParams);
  /** Returns all items form IDB as an array */
  getAll(): Promise<V[]>;
  removeAll(): Promise<void>;
  hasKey(key: K): Promise<boolean>;
  get(key: K | '__lastTimeUpdated'): Promise<V | null>;
  remove(key: K, removeJustLocally?: boolean): Promise<void>;
  /**
   * Creates data on the backend and uses the received `id` to save it locally.
   * Only use this method for items not created by {@link put} to avoid key mismatch!
   */
  add(data: W): Promise<string>;
  put(key: K | '__lastTimeUpdated', data: V, insertJustLocally?: boolean): Promise<void>;
  /**
   * Loads data from the cloud and returns true if there was a change
   */
  loadFromCloud(): Promise<boolean>;
}
