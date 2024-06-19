import type { ExternalPluginConfig } from '@windy/interfaces';

// Configuration derived from package.json.
export interface GeneratedConfig {
  author: string;
  name: `windy-plugin-${string}`;
  version: string;
  description?: string;
  repository?: string;
  built: number;
  builtReadable: string;
}

// User configuration.
export interface PluginConfig extends Omit<ExternalPluginConfig, keyof GeneratedConfig> {
  screenshot?: string;
}

export const pluginConfig: PluginConfig = {
  title: 'Better Soundings',
  icon: '⛅️',
  desktopUI: 'rhpane',
  mobileUI: 'small',
  routerPath: '/sdg/:lat?/:lon?',
  desktopWidth: 600,
  addToContextmenu: true,
  listenToSingleclick: true,
  screenshot: 'screenshot.jpg',
};
