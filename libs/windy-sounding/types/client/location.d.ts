/**
 * # @windy/location
 *
 * Modifies URL of the page and document title. Well configured
 * plugins need to use this module to change URL and title of the page
 * ONLY when their parameters are changed.
 *
 * @example
 * ```typescript
 * import { setUrl, setTitle } from '@windy/location';
 *
 * export const onopen = (params: PluginParams) => {
 *    // We DO NOT NEED to set URL and title here!!!
 *    // Windy's plugin system will do it for us automatically
 * }
 *
 * // Here we detect change of params
 * export const onpPramsChanged = (newParams: PluginParams) => {
 *    setUrl('windy-plugin-name', newParams);
 *    setTitle('New title for ne params');
 * }
 * ```
 *
 * @module location
 */
import type { ExternalPluginIdent } from '@windy/types.d';
import type { PluginIdent } from '@windy/Plugin';
import type { WindowPlugins } from '@windy/WindowPlugin';
import type { PluginsOpenParams } from '@windy/plugin-params';
/**
 * At what time, the search string was last time updated
 * @param ovr
 * @returns
 */
/**
 * Sets browser's description meta tag for purpose of SEO
 */
export declare const description: (desc: string) => void;
/**
 * Gets current browser's URL (for example for purpose of sharing)
 */
export declare const getURL: () => string;
/**
 * Resets browser's title to initial value
 * Windy's plugin system should do it automatically
 */
export declare function resetTitle(): void;
/**
 * Set URL of page. PluginId makes sure, that only plugin that changed URL can
 * reset it later on.
 * @param pluginId id, respective name of the plugin that is updating the URL
 * @param pluginParams parameters of the plugin. Same parameters as plugin receives in its onopen method
 * @param seoPrefix SEO prefix of the URL
 */
export declare const setUrl: <P extends keyof WindowPlugins>(
  pluginId: `windy-plugin-${string}` | P,
  pluginParams?: PluginsOpenParams[P],
  seoPrefix?: string,
) => void;
/**
 * Sets browser's title of a page
 */
export declare const setTitle: (newTitle: string) => void;
/**
 * Sets browser's search string (the part after ?)
 *
 * TODO: Only subscription plugin uses this method
 * There is potentional BUG that debounced change in some parameters
 * will overwrite this change
 * @ignore
 */
export declare const setSearch: (newSearch?: string) => void;
/**
 * Reset both, title & URL, to its default values. PluginId makes sure, that
 * only plugin that changed URL can reset it. Well configured plugins should
 * not need to call this method, and Windy's plugin system should do it
 * for you automatically.
 *
 * @param pluginId Plugin ident (or null if called not from plugin)
 */
export declare const reset: (pluginId?: PluginIdent | ExternalPluginIdent) => void;
