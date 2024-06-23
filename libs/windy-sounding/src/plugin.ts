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

// Set the build timestamp on the dev server.
if (process.env.NODE_ENV !== 'production') {
  (window as any).__BUILD_TIMESTAMP__ = Date.now();
}

if (!pluginConfig.name.startsWith('windy-plugin-')) {
  throw new Error(`Plugin name "${pluginConfig.name}" should start with "windy-plugin-".`);
}

export { pluginConfig as __pluginConfig, Plugin as default };
