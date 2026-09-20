/// <reference types="svelte" />
import store from '@windy/store';
import type { StoreTypes } from '@windy/store.d';
import type { Evented as MaplibreEvented, Listener, MapEventType, MapLayerEventType, LeafletEventHandlerFn } from '@leafletGl';
import type { Evented } from '@windy/Evented';
import type { BcastTypes } from '@windy/broadcast.d';
import type { Plugins } from '@windy/plugins.d';
import type { Readable, Subscriber } from 'svelte/store';
type MapLibreEventTypes = MapLayerEventType | MapEventType | string;
type BcastEventTypes = keyof BcastTypes<keyof Plugins>;
/**
 * @class A class for managing event listeners
 *  - used to safely bind AND unbind listeners by storing callback references
 */
export declare class EventManager {
    private DOMCallbacks;
    private MapLibreCallbacks;
    private storeCallbacks;
    private eventedCallbacks;
    private broadcastCallbacks;
    private mapCallbacks;
    private unsubscribers;
    /**
     * @summary Registers specific event listener on a given DOM target with a given callback
     * @param target    - target to listen on
     * @param topic     - which event to listen for
     * @param callback  - callback function that should process the event
     */
    addDOMListener<T extends EventTarget>(target: T, topic: Parameters<T['addEventListener']>[0], callback: Parameters<T['addEventListener']>[1]): void;
    /**
     * @summary Registers specific event listener on a given MapLibre target with a given callback
     * @param target    - target to listen on
     * @param topic     - which event to listen for
     * @param callback  - callback function that should process the event
     */
    addMapLibreListener<T extends MapLibreEventTypes>(target: MaplibreEvented, topic: T, callback: Listener): void;
    /**
     * @summary Registers specific event listener on windy store with a given callback
     * @param topic     - which event to listen for
     * @param callback  - callback function that should process the event
     */
    addStoreListener<T extends keyof StoreTypes>(topic: T, callback: Parameters<(typeof store)['on']>[1]): void;
    /**
     * @summary Registers specific event listener on a given windy/evented target with a given callback
     * @param target    - target to listen on
     * @param topic     - which event to listen for
     * @param callback  - callback function that should process the event
     */
    addEventedListener<T>(target: Evented<T>, topic: keyof T, callback: (typeof this.eventedCallbacks)[string][number]['ref']): void;
    /**
     * @summary Registers specific event listener on windy broadcast with a given callback
     * @param topic     - which event to listen for
     * @param callback  - callback function that should process the event
     */
    addBroadcastListener(topic: BcastEventTypes, callback: (typeof this.broadcastCallbacks)[string][number]['ref']): void;
    addMapListener(topic: string, callback: LeafletEventHandlerFn): void;
    addSvelteStoreListener<T>(svelteStore: Readable<T>, callback: Subscriber<T>, onlyOnChange?: boolean): void;
    /**
     * Subscribe to DOM mutations using MutationObserver
     *
     * See https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     */
    addMutationObserverListener(target: Node, options: MutationObserverInit, callback: MutationCallback): void;
    /**
     * @summary Cleanup method to remove (unregister) all registered listeners
     */
    removeListeners(): void;
}
export {};
