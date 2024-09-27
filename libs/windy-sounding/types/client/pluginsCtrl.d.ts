/**
 * # @windy/pluginCtrl
 *
 * Handles opening and closing of plugins, solving UI collisions by closing plugins
 * that can overlap other plugins.
 *
 * Can be used from other modules
 * just by emitting `rqstOpen`, `rqstClose` or `closeAllPlugins` events,
 * on {@link module:bcast} channel in order to avoid circular dependencies.
 *
 * Unless we are opening external plugins, `openPlugin` provides satisfactory
 * type safety of provided plugin parameters.
 *
 * @module pluginsCtrl
 */
export {};
