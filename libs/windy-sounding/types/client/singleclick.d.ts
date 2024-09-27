/**
 * # @windy/singleclick
 *
 * Handles singleclick events on map and determines, which consumer should get it.
 * If none is found, it emits event with `click` topic, which is usually cached by `@windy/picker`
 * module and it opens weather picker on desired location.
 *
 * @example
 * ```typescript
 * import { singleclick } from '@windy/singleclick';
 *
 * // Plugin will get singleclick events ONLY if they are properly configured
 * // to get singleclick events
 * singleclick.on('windy-plugin-name', (ev) => {
 *    console.log('I got singleclick event', ev);
 * })
 * ```
 *
 * @module singleclick
 */
import { Evented } from '@windy/Evented';
import type { PluginIdent } from './d.ts.files/Plugin';
import type { SingleclickTypes, ListeningPriority } from './d.ts.files/singleclick';
/**
 * Main singleclick event emitter (instance of class {@link Evented.Evented | Evented }.)
 *
 * It contains well defined methods `on`, `off` and `once`
 * and it emits events, whose topic is one of eligible consumer
 */
export declare const singleclick: Evented<SingleclickTypes>;
/**
 * Register the plugin (identified by its ident) to be on the list to
 * receive singleclick events.
 *
 * There can be only one listener with high priority (usually actually opened
 * plugin), and one with low priority (usually some map layer).
 *
 * Well configured plugins do not need to use this method, as they are automatically
 * released, by Windy's plugin system when they are closed.
 */
export declare const register: (
  ident: PluginIdent,
  priority: ListeningPriority,
) => keyof import('../pluginSystem/plugins').Plugins;
/**
 * Release the plugin from the list of singleclick events. Well configured plugins
 * do not need to use this method, as they are automatically released, by Windy's
 * plugin system when they are closed.
 */
export declare const release: (ident: PluginIdent, priority: ListeningPriority) => void;
/**
 * Handles all singleclick events from instance of Leaflet map
 * @ignore
 */
export declare const opener: (ev: L.LeafletMouseEvent) => void;
