/**
 * @ignore
 */
export type EventedInitParams = {
  ident: string;
};
/**
 * # @windy/Evented
 *
 * Major Windy.com even emitter class. Used in @windy/broadcast, @windy/store and other parts of Windy.com
 * where publish / subscribe pattern is used.
 *
 * Enjoy, widely known methods like `on`, `off`, `once` and `emit`
 * (if you are used to, you can also use `trigger` or `fire`).
 */
export declare class Evented<T> {
  /**
   * Unique ID of each event subscription (incremental)
   */
  private latestId;
  /**
   * Store of all active subscriptions. It holds all needed data for trigger listeners for any event.
   */
  private _eventedCache;
  /**
   * For purpose of developer mode
   */
  private listenAllMethod?;
  /**
   * Only for DEBUG purposes. Color for console.log printing
   */
  private terminalColor?;
  /**
   * Identificator of event instance
   */
  private ident;
  /**
   * Same as `emit` method, just someone, who likes to use it.
   */
  trigger?: (typeof this)['emit'];
  /**
   * Same as `emit` method, just someone, who likes to use it.
   */
  fire?: (typeof this)['emit'];
  constructor(params: EventedInitParams);
  /**
   * Emits a message accompanied from one to four arguments.
   *
   * @param topic Topic to emit
   * @param data Optional data
   */
  emit<K extends keyof T, Q extends T[K]>(topic: keyof T, ...data: TrimUndefinedFromRight<Arrayify<Q>>): void;
  /**
   * Hooks a callback, that will be triggerd on specified message.
   *
   * @param topic Topic to subscribe
   * @param callback Callback called when topic is emitted
   * @param context Optional context to change this binding
   * @param once Optional if callback should be fired only once or at every time
   * @returns Unsubscribe id
   */
  on<K extends keyof T, Q extends T[K]>(
    topic: K,
    callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
    context?: ThisType<unknown>,
    once?: boolean,
  ): number;
  /**
   * Hooks a callback, that will be triggerd just once on specified message.
   *
   * @param topic Topic to subscribe
   * @param callback Callback called when topic is emitted
   * @param context Optional context to change this binding
   * @returns Unsubscribe id
   */
  once<K extends keyof T, Q extends T[K]>(
    topic: K,
    callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
    context?: ThisType<unknown>,
  ): number;
  off(id: number): void;
  off<K extends keyof T, Q extends T[K]>(
    topic: K,
    callback: (...data: TrimUndefinedFromRight<Arrayify<Q>>) => void,
    context?: ThisType<unknown>,
  ): void;
  /**
   * @ignore
   */
  listenAll(callback: (topic: keyof T, ...args: unknown[]) => void): void;
}
