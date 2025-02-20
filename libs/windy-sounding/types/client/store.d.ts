/**
 * # @windy/store
 *
 * Represents a key-value store with methods for getting, setting, and observing values.
 * The store maintains the integrity of the parameters and checks the validity of the input.
 *
 * Used store keys are defined as `DataSpecifications` interface.
 *
 * Check out complete list of {@link DataSpecifications.DataSpecifications | store properties}.
 *
 * Used for storing major parameters and user settings.
 *
 * It also supports observing changes to the values and retrieving allowed values for each key.
 *
 * Use methods `get` to read value from store, `set` to change value in the store and `on` to observe change of the value.
 * Some of the items respond to method `getAllowed` to return array of allowed values.
 *
 * Method `set` returns `true` if provided value was valid and was actually changed.
 *
 * Store is instance of class {@link Evented.Evented | Evented }.
 *
 * @example
 * ```js
 * var overlay = store.get('overlay');
 * // 'wind' ... actually used overlay
 *
 * var allowedOverlays = store.getAllowed('overlay');
 * // ['wind', 'rain', ... ] ... list of allowed values
 *
 * store.set('overlay', 'rain');
 * // true ... Overlay was changed to rain
 *
 * store.on('overlay', ovr => {
 *      // Called when value was changed
 * });
 * ```
 *
 * @module store
 */
import { Evented } from '@windy/Evented';
import type { DataSpecifications, DataSpecificationsObject } from './d.ts.files/dataSpecifications.d';
import type { SetReturnType, StoreOptions, StoreTypes } from './d.ts.files/store.d';
declare class Store extends Evented<StoreTypes> {
  /**
   * Set default value for given key
   *
   * @param name Name
   * @param value Value
   */
  setDefault<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(name: T, value: Item['def']): void;
  /**
   * Defines property in dataSpecification list. Used for example for
   * definition of `syncSet` or `asyncSet`
   *
   * @param name identifier of property in dataSpecification
   * @param prop property
   * @param value Value
   */
  defineProperty: <
    T extends keyof DataSpecifications,
    Prop extends keyof DataSpecifications[T],
    Value extends DataSpecifications[T][Prop],
  >(
    name: T,
    prop: Prop,
    value: Value,
  ) => void;
  /**
   * Retrieves property from dataSpecifications
   *
   * @param name identifier of property in dataSpecification
   * @returns Stored value
   */
  getProperty: <T extends keyof DataSpecifications>(name: T) => DataSpecifications[T];
  /**
   * Checks existence of property
   *
   * @param name Name
   * @returns True if property exists
   */
  hasProperty: <T extends keyof DataSpecifications>(name: T) => boolean;
  /**
   * Sets a value in key, value store. If succesfull,a nd value has been changed, store will brodcast message with name and value.
   * Limitation:** Our store is quite primitive so it can not compare Arrays and Objects. Always create new one or use `forceChange` * option.
   *
   * @param name Name
   * @param value Value
   * @param opts Options
   * @returns optional, returns true if value was changed, undefined if change failed, Promise obj if change was asynchronous
   */
  set<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    value: Item['def'] | null,
    opts?: StoreOptions,
  ): SetReturnType<T>;
  /**
   * Set it to null leading to defaults values
   *
   * @param name Name
   * @param opts Options
   */
  remove: <T extends keyof DataSpecifications>(name: T, opts?: StoreOptions) => void;
  /**
   * Outputs all allowed properties for give key into console.log
   */
  getAll: () => void;
  /**
   * Return list of permitted values for given key
   *
   * @param name Name
   * @returns List of allowed values for the name; or string with info it is checked by function
   */
  getAllowed: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
  ) => string | Item['allowed'];
  /**
   * Returns default value for given key
   *
   * @param name Name
   * @returns Data specification type
   */
  getDefault<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(name: T): Item['def'];
  isAsyncStore<T>(
    item: DataSpecificationsObject<T>,
  ): item is DataSpecificationsObject<T> & Required<Pick<DataSpecificationsObject<T>, 'asyncSet'>>;
  /**
   * Check if value was changed
   * !!!! WARNING: for perfomance reasons check only against hot cache, so can
   * lead to faulty results around default || never used values
   *
   * @param name Name
   * @param item Item
   * @param value Value
   * @returns True if value was changed
   */
  wasChanged<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    item: Item,
    value: Item['def'],
  ): boolean;
  /**
   * Insert dataSpecifications key (if not present)
   *
   * @param name Name
   * @param obj Data specifications object
   */
  insert: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(name: T, obj: Item) => void;
  /**
   * Retrieves value stored in store
   *
   * @param {string} name Name
   * @param {boolean} options.forceGet Skip cache and return even nullish value with no default polyfill
   * @returns stored value
   */
  get<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    options?: {
      forceGet: boolean;
    },
  ): Item['def'];
  isValid<T>(item: DataSpecificationsObject<T>, value: T): boolean;
  private setFinally;
}
declare const store: Store;
export declare const getAll: () => void,
  getAllowed: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
  ) => string | Item['allowed'],
  getDefault: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(name: T) => Item['def'],
  get: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    options?: {
      forceGet: boolean;
    },
  ) => Item['def'],
  on: <K extends keyof StoreTypes, Q extends StoreTypes[K]>(
    topic: K,
    callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
    context?: ThisType<unknown>,
    once?: boolean,
  ) => number,
  off: {
    (id: number): void;
    <K extends keyof StoreTypes, Q extends StoreTypes[K]>(
      topic: K,
      callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
      context?: ThisType<unknown>,
    ): void;
  },
  once: <K extends keyof StoreTypes, Q extends StoreTypes[K]>(
    topic: K,
    callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
    context?: ThisType<unknown>,
  ) => number,
  set: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    value: Item['def'],
    opts?: StoreOptions,
  ) => SetReturnType<T>,
  defineProperty: <
    T extends keyof DataSpecifications,
    Prop extends keyof DataSpecifications[T],
    Value extends DataSpecifications[T][Prop],
  >(
    name: T,
    prop: Prop,
    value: Value,
  ) => void,
  setDefault: <T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(
    name: T,
    value: Item['def'],
  ) => void;
export default store;
