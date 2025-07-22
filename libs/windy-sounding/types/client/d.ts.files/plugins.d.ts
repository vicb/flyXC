import { BottomSveltePlugin } from '@windy/BottomSveltePlugins';
import { Plugin } from '@windy/Plugin';
import { SveltePanePlugin } from '@windy/SveltePanePlugin';
import { SveltePlugin } from '@windy/SveltePlugin';
import { TagPlugin } from '@windy/TagPlugin';

export interface BottomSveltePlugins {
  'mobile-calendar'?: BottomSveltePlugin<'mobile-calendar'>;
  'progress-bar'?: BottomSveltePlugin<'progress-bar'>;

  'day-switcher': BottomSveltePlugin<'day-switcher'>;
  'cap-alerts': BottomSveltePlugin<'cap-alerts'>;
  accumulations: BottomSveltePlugin<'accumulations'>;
}

export interface SveltePanePlugins {
  favs: SveltePanePlugin<'favs'>;
  'alerts-edit': SveltePanePlugin<'alerts-edit'>;
  alerts: SveltePanePlugin<'alerts'>;
  colors: SveltePanePlugin<'colors'>;
  articles: SveltePanePlugin<'articles'>;
  debug: SveltePanePlugin<'debug'>;
  hurricanes: SveltePanePlugin<'hurricanes'>;
  'cap-alert': SveltePanePlugin<'cap-alert'>;
  'delete-info': SveltePanePlugin<'delete-info'>;
  settings: SveltePanePlugin<'settings'>;
  sounding: SveltePanePlugin<'sounding'>;
  radiosonde: SveltePanePlugin<'radiosonde'>;
  airport: SveltePanePlugin<'airport'>;
  info: SveltePanePlugin<'info'>;
  webcams: SveltePanePlugin<'webcams'>;
  'webcams-detail': SveltePanePlugin<'webcams-detail'>;
  'webcams-add': SveltePanePlugin<'webcams-add'>;
  'webcams-edit': SveltePanePlugin<'webcams-edit'>;
  'webcams-remove': SveltePanePlugin<'webcams-remove'>;

  uploader?: SveltePanePlugin<'uploader'>;
  'external-plugins'?: SveltePanePlugin<'external-plugins'>;
}

export interface SveltePlugins {
  login: SveltePlugin<'login'>;
  'nearest-webcams': SveltePlugin<'nearest-webcams'>;
  'nearest-webcams-mobile': SveltePlugin<'nearest-webcams-mobile'>;
  'nearest-airq': SveltePlugin<'nearest-airq'>;
  'nearest-stations': SveltePlugin<'nearest-stations'>;
  share: SveltePlugin<'share'>;
  multimodel: SveltePlugin<'multimodel'>;
  subscription: SveltePlugin<'subscription'>;
  'pending-subscription': SveltePlugin<'pending-subscription'>;
  detail: SveltePlugin<'detail'>;
  station: SveltePlugin<'station'>;
  consent: SveltePlugin<'consent'>;
  rplanner: SveltePlugin<'rplanner'>;
  menu: SveltePlugin<'menu'>;
  'fav-alert-menu': SveltePlugin<'fav-alert-menu'>;
  radar: SveltePlugin<'radar'>;
  satellite: SveltePlugin<'satellite'>;
  'radar-plus': SveltePlugin<'radar-plus'>;
  'map-selector': SveltePlugin<'map-selector'>;

  // Mobile/desktop only plugins
  distance?: SveltePlugin<'distance'>;
  'watch-faces'?: SveltePlugin<'watch-faces'>;
  'app-review-dialog'?: SveltePlugin<'app-review-dialog'>;
  widgets?: SveltePlugin<'widgets'>;
  garmin?: SveltePlugin<'garmin'>;
  'fav-layers'?: SveltePlugin<'fav-layers'>;
  onboarding?: SveltePlugin<'onboarding'>;
  'developer-mode'?: SveltePlugin<'developer-mode'>;
  'pin-to-homepage'?: SveltePlugin<'pin-to-homepage'>;
  'startup-whats-new'?: SveltePlugin<'startup-whats-new'>;
  'rhpane-top': SveltePlugin<'rhpane-top'>;
  rhbottom?: SveltePlugin<'rhbottom'>;
  'location-permission'?: SveltePlugin<'location-permission'>;

  'startup-weather'?: SveltePlugin<'startup-weather'>;
  'mobile-ui'?: SveltePlugin<'mobile-ui'>;
  'embed-ui'?: SveltePlugin<'embed-ui'>;
  contextmenu?: SveltePlugin<'contextmenu'>;
  upload: SveltePlugin<'upload'>;
  search: SveltePlugin<'search'>;
  'startup-articles'?: SveltePlugin<'startup-articles'>;
  'picker-mobile'?: SveltePlugin<'picker-mobile'>; // to Svelte plugin

  // Used as fake plugin for any other external plugin
  // basically we are unable to type each individual external plugin
  'windy-external-plugin'?: SveltePlugin<'windy-external-plugin'>;
  stories: SveltePlugin<'stories'>;
}

export interface PlainPlugins {
  'gl-particles': Plugin<'gl-particles'>;
  'legacy-tile-render': Plugin<'legacy-tile-render'>;
  particles: Plugin<'particles'>;
  isolines: Plugin<'isolines'>;
}

export interface TagPlugins {
  // These plugins have css only (no html)
  'poi-libs': TagPlugin<'poi-libs'>;
  picker?: TagPlugin<'picker'>;
  globe?: TagPlugin<'globe'>;
  'heatmaps-redirect': TagPlugin<'heatmaps-redirect'>;
}

export interface Plugins extends TagPlugins, SveltePlugins, SveltePanePlugins, PlainPlugins, BottomSveltePlugins {}

export interface WindowPlugins extends TagPlugins, SveltePlugins, SveltePanePlugins, BottomSveltePlugins {}
