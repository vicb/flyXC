/**
 * Main entry point for the Windy plugin.
 *
 * Windy plugins are loaded as ES modules expecting:
 * - A default export class implementing the plugin lifecycle (`constructor`, `onopen`, `$destroy`).
 * - A named export `__pluginConfig` containing plugin metadata.
 *
 * @see https://docs.windy-plugins.com/getting-started/
 * @see https://docs.windy-plugins.com/getting-started/#lifecycle-of-the-plugin
 */

import type { ExternalSvelteApp } from '@windy/client/SveltePlugin';

import { pluginConfig } from './config';
import { destroyPlugin, mountPlugin, openPlugin } from './sounding';
import { loadSetting, Settings } from './util/settings';

class Plugin implements ExternalSvelteApp {
  private contentEl: HTMLElement;

  /**
   * Called once when Windy mounts the plugin pane into the DOM.
   * @param options.target The parent DOM element provided by Windy.
   */
  constructor(options: { target: HTMLElement }) {
    this.contentEl = document.createElement('section');
    this.contentEl.className = 'plugin__content';
    options.target.appendChild(this.contentEl);
    mountPlugin(this.contentEl);
  }

  /**
   * Called whenever the plugin is opened (via URL router or context menu).
   * Note: This method can be called multiple times during the plugin's lifecycle.
   *
   * @see https://docs.windy-plugins.com/getting-started/#opening-plugin-with-parameters
   */
  onopen(parameters: any) {
    let lat = parameters?.lat;
    let lon = parameters?.lon;

    if (lat === undefined || lon === undefined) {
      try {
        const location = JSON.parse(loadSetting(Settings.location));
        lat ??= location.lat;
        lon ??= location.lon;
      } catch {
        // empty
      }
    }

    const mapCenter = W.map.map.getCenter();
    lat = Number(lat ?? mapCenter.lat);
    lon = Number(lon ?? mapCenter.lng);
    const modelName = parameters?.modelName ?? loadSetting(Settings.model) ?? W.store.get('product');
    openPlugin({ lat, lon, modelName });
  }

  /**
   * Called once when the plugin is closed or unloaded by Windy.
   */
  $destroy() {
    destroyPlugin();
    this.contentEl.remove();
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
