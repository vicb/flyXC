/**
 * Plugin entry point.
 *
 * This should not be edited.
 *
 * Configure your plugin in lib/plugin-config.ts.
 * Develop your plugin in lib/Plugin.svelte.
 */

import pkg from '../package.json';
import Plugin from './lib/Plugin.svelte';
import { pluginConfig } from './lib/plugin-config';

// Set the build timestamp on the dev server.
if (process.env.NODE_ENV !== 'production') {
  (window as any).__BUILD_TIMESTAMP__ = Date.now();
}

// See lib/plugin-config.ts for editable options
const __pluginConfig = {
  author: pkg.author,
  name: pkg.name as `windy-plugin-${string}`,
  version: pkg.version,
  description: pkg.description,
  repository: pkg.repository.url ?? String(pkg.repository),
  built: Number(__BUILD_TIMESTAMP__),
  builtReadable: new Date(__BUILD_TIMESTAMP__).toISOString(),
  ...pluginConfig,
};

// Set the build timestamp in dev mode.
if (process.env.NODE_ENV !== 'production' && !validatePluginName(__pluginConfig.name)) {
  throw new Error(`Plugin name "${__pluginConfig.name}" should start with "windy-plugin-".`);
}

function validatePluginName(name: string): name is `windy-plugin-${string}` {
  return name.startsWith('windy-plugin-');
}

export { __pluginConfig, Plugin as default };
