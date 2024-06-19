import type { PluginConfig } from '../types';

export function init(config: PluginConfig) {
  // Set the build timestamp on the dev server.
  if (process.env.NODE_ENV !== 'production') {
    (window as any).__BUILD_TIMESTAMP__ = Date.now();
  }

  if (!validatePluginName(config.name)) {
    throw new Error(`Plugin name "${config.name}" should start with "windy-plugin-".`);
  }
}

export function injectStyles(styles: string) {
  const { head } = document;
  const style = document.createElement('style');
  head.appendChild(style);
  style.appendChild(document.createTextNode(styles));
}

function validatePluginName(name: string): name is `windy-plugin-${string}` {
  return name.startsWith('windy-plugin-');
}
