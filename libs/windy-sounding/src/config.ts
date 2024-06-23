import pkg from '../package.json';
import type { PluginConfig, PluginUserConfig } from './types';

// User configuration.
const userConfig: PluginUserConfig = {
  title: 'flyXC Soundings',
  icon: '⛅️',
  desktopUI: 'rhpane',
  mobileUI: 'small',
  routerPath: '/sdg/:modelName?/:lat?/:lon?',
  desktopWidth: 600,
  addToContextmenu: true,
  listenToSingleclick: true,
  // The screenshot file in the public folder.
  screenshot: 'screenshot.jpg',
};

// Automatic configuration, edit with care.
export const pluginConfig: PluginConfig = {
  author: pkg.author,
  name: pkg.name as `windy-plugin-${string}`,
  version: pkg.version,
  description: pkg.description,
  repository: pkg.repository.url ?? String(pkg.repository),
  built: Number(__BUILD_TIMESTAMP__),
  builtReadable: new Date(__BUILD_TIMESTAMP__).toISOString(),
  ...userConfig,
};
