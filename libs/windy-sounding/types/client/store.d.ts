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
import type { DataSpecifications } from './d.ts.files/dataSpecifications.d';
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
   * Defines property in dataSpecification list. Used only for
   * definition of `syncSet` or `asyncSet`
   *
   * @param name identifier of property in dataSpecification
   * @param prop property
   * @param value Value
   */
  defineProperty: <
    T extends keyof DataSpecifications,
    Prop extends 'asyncSet' | 'syncSet',
    Value extends DataSpecifications[T][Prop],
  >(
    name: T,
    prop: Prop,
    value: Value,
  ) => void;
  /**
   * Sets a value in key, value store. If successful, and value has been changed, store will broadcast message with name and value.
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
   * Returns default value for given key
   *
   * @param name Name
   * @returns Data specification type
   */
  getDefault<T extends keyof DataSpecifications, Item extends DataSpecifications[T]>(name: T): Item['def'];
  /**
   * Insert dataSpecifications key (if not present). So far used only for
   * runtime inserting of Metrics
   * @deprecated
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
  private isAsyncStore;
  /**
   * Check if value was changed
   * !!!! WARNING: for performance reasons check only against hot cache, so can
   * lead to faulty results around default || never used values
   *
   * @param name Name
   * @param item Item
   * @param value Value
   * @returns True if value was changed
   */
  private wasChanged;
  private isValid;
  private setFinally;
}
declare const store: Store;
export default store;
