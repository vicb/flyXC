/**
 * Plugin entry point.
 *
 * Configure your plugin in lib/plugin-config.ts.
 * Develop your plugin in lib/Plugin.svelte.
 */

import { mount, unmount } from 'svelte';
import { pluginConfig } from './config';
import PluginSvelte from './Plugin.svelte';

class Plugin {
  private instance: Record<string, any>;

  constructor(options: { target: HTMLElement; props?: Record<string, any> }) {
    this.instance = mount(PluginSvelte, {
      target: options.target,
      props: options.props,
    });
  }

  onopen(parameters: any) {
    if (typeof this.instance.onopen === 'function') {
      return this.instance.onopen(parameters);
    }
  }

  $destroy() {
    unmount(this.instance);
  }
}

// Set the build timestamp on the dev server.
if (process.env.NODE_ENV !== 'production') {
  (window as any).__BUILD_TIMESTAMP__ = Date.now();
  if (!pluginConfig.name.startsWith('windy-plugin-')) {
    throw new Error(`Plugin name "${pluginConfig.name}" should start with "windy-plugin-".`);
  }
}

export { pluginConfig as __pluginConfig, Plugin as default };
