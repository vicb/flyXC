/**
 * # @windy/pluginCtrl
 *
 * Handles opening and closing of plugins, solving UI collisions by closing plugins
 * that can overlap other plugins.
 *
 * Can be used from other modules
 * just by emitting `rqstOpen`, `rqstClose` events,
 * on {@link module:bcast} channel in order to avoid circular dependencies.
 *
 * Unless we are opening external plugins, `openPlugin` provides satisfactory
 * type safety of provided plugin parameters.
 *
 * @module pluginsCtrl
 */
import type { PluginIdent, PluginPane } from '@windy/Plugin';
import type { ExternalPluginIdent } from '@windy/types';
/**
 * Closes all panes in particular panes
 * Since it is forced closing, closing animation is not required and we want to
 * hide plugin ASAP
 */
export declare const closePanes: (myIdent: PluginIdent | ExternalPluginIdent, panes: PluginPane[]) => void;
/**
 * Close all opened plugins, except the one provided as excluded
 *
 * @param excluded Do not close these plugins
 */
export declare function closeAllPlugins(excluded?: PluginIdent): void;
