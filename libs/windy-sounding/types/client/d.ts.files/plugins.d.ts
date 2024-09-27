import { BottomTagPlugin } from '@windy/BottomTagPlugin';
import { Plugin } from '@windy/Plugin';
import { SveltePanePlugin } from '@windy/SveltePanePlugin';
import { SveltePlugin } from '@windy/SveltePlugin';
import { TagPlugin } from '@windy/TagPlugin';

export interface BottomTagPlugins {
  accumulations: BottomTagPlugin<'accumulations'>;
  radar: BottomTagPlugin<'radar'>;
  satellite: BottomTagPlugin<'satellite'>;
  'cap-alerts': BottomTagPlugin<'cap-alerts'>;
  'day-switcher': BottomTagPlugin<'day-switcher'>;

  // mobile only, not embed
  'mobile-calendar'?: BottomTagPlugin<'mobile-calendar'>;

  // embed or desktop only
  'progress-bar'?: BottomTagPlugin<'progress-bar'>;
}

export interface SveltePanePlugins {
  favs: SveltePanePlugin<'favs'>;
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
  offline: SveltePlugin<'offline'>;
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

  // Mobile/desktop only plugins
  distance?: SveltePlugin<'distance'>;
  'watch-faces'?: SveltePlugin<'watch-faces'>;
  'app-review-dialog'?: SveltePlugin<'app-review-dialog'>;
  'fav-layers'?: SveltePlugin<'fav-layers'>;
  'developer-mode'?: SveltePlugin<'developer-mode'>;
  'pin-to-homepage'?: SveltePlugin<'pin-to-homepage'>;
  'startup-whats-new'?: SveltePlugin<'startup-whats-new'>;
  'rhpane-top': SveltePlugin<'rhpane-top'>;

  'startup-weather'?: SveltePlugin<'startup-weather'>;

  // Used as fake plugin for any other external plugin
  // basically we are unable to type each individual external plugin
  'windy-external-plugin'?: SveltePlugin<'windy-external-plugin'>;
}

export interface PlainPlugins {
  'gl-particles': Plugin<'gl-particles'>;
  'legacy-tile-render': Plugin<'legacy-tile-render'>;
  particles: Plugin<'particles'>;
  startup?: Plugin<'startup'>;
}

export interface TagPlugins {
  /**
   * Libraries with possible CSS, that remains opened
   */
  rhbottom: TagPlugin<'rhbottom'>;
  'poi-libs': TagPlugin<'poi-libs'>;

  /**
   * Tag Plugins
   */
  upload: TagPlugin<'upload'>;
  screenshot: TagPlugin<'screenshot'>;
  isolines: TagPlugin<'isolines'>;
  search: TagPlugin<'search'>;

  // not embed plugins
  'startup-articles'?: TagPlugin<'startup-articles'>;

  // desktop only plugins
  contextmenu?: TagPlugin<'contextmenu'>;
  picker?: TagPlugin<'picker'>;
  globe?: TagPlugin<'globe'>;

  // mobile only plugins
  'picker-mobile'?: TagPlugin<'picker-mobile'>;
  'promo-mobile-intro'?: TagPlugin<'promo-mobile-intro'>;
  profile?: TagPlugin<'profile'>;
  'save-password'?: TagPlugin<'save-password'>;
  browser?: TagPlugin<'browser'>;
  'map-selector'?: TagPlugin<'map-selector'>;
}

export interface Plugins extends TagPlugins, SveltePlugins, SveltePanePlugins, PlainPlugins, BottomTagPlugins {}

export interface WindowPlugins extends TagPlugins, SveltePlugins, SveltePanePlugins, BottomTagPlugins {}
