/**
 * Plugin entry point.
 *
 * This should not be edited.
 *
 * Configure your plugin in lib/plugin-config.ts.
 * Develop your plugin in lib/Plugin.svelte.
 */

import { pluginConfig } from './config';
import Plugin from './Plugin.svelte';
import styles from './styles.less?inline';
import { init, injectStyles } from './util/utils';

init(pluginConfig);
injectStyles(styles);

export { pluginConfig as __pluginConfig, Plugin as default };
