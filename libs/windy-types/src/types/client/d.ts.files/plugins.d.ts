import { BottomSveltePlugin } from '@windy/BottomSveltePlugins';
import { Plugin } from '@windy/Plugin';
import { SveltePanePlugin } from '@windy/SveltePanePlugin';
import { SveltePlugin } from '@windy/SveltePlugin';
import { SveltePopupPlugin } from '@windy/SveltePopupPlugin';
import { TagPlugin } from '@windy/TagPlugin';
import { StartupElementPlugin } from '@windy/StartupElementPlugin';

export interface BottomSveltePlugins {
    'mobile-calendar': BottomSveltePlugin<'mobile-calendar'>;
    'progress-bar': BottomSveltePlugin<'progress-bar'>;
    'day-switcher': BottomSveltePlugin<'day-switcher'>;
    'cap-alerts': BottomSveltePlugin<'cap-alerts'>;
    'avalanche-danger': BottomSveltePlugin<'avalanche-danger'>;
    'levels-range': BottomSveltePlugin<'levels-range'>;
    'fire-danger': BottomSveltePlugin<'fire-danger'>;
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
    'cap-alerts-detail': SveltePanePlugin<'cap-alerts-detail'>;
    'avalanche-danger-detail': SveltePanePlugin<'avalanche-danger-detail'>;
    'delete-info': SveltePanePlugin<'delete-info'>;
    settings: SveltePanePlugin<'settings'>;
    sounding: SveltePanePlugin<'sounding'>;
    radiosonde: SveltePanePlugin<'radiosonde'>;
    airport: SveltePanePlugin<'airport'>;
    info: SveltePanePlugin<'info'>;
    webcams: SveltePanePlugin<'webcams'>;
    'webcams-detail': SveltePanePlugin<'webcams-detail'>;
    'report-issue': SveltePanePlugin<'report-issue'>;
    'external-plugins': SveltePanePlugin<'external-plugins'>;

    uploader: SveltePanePlugin<'uploader'>;
}

export interface SveltePopupPlugins {
    login: SveltePopupPlugin<'login'>;
    subscription: SveltePopupPlugin<'subscription'>;
    consent: SveltePopupPlugin<'consent'>;
    'default-model-selector': SveltePopupPlugin<'default-model-selector'>;
}

export interface SveltePlugins {
    'nearest-webcams': SveltePlugin<'nearest-webcams'>;
    'nearest-webcams-mobile': SveltePlugin<'nearest-webcams-mobile'>;
    'nearest-stations': SveltePlugin<'nearest-stations'>;
    share: SveltePlugin<'share'>;
    multimodel: SveltePlugin<'multimodel'>;
    'pending-subscription': SveltePlugin<'pending-subscription'>;
    detail: SveltePlugin<'detail'>;
    station: SveltePlugin<'station'>;
    rplanner: SveltePlugin<'rplanner'>;
    menu: SveltePlugin<'menu'>;
    'radar-plus': SveltePlugin<'radar-plus'>;
    'map-selector': SveltePlugin<'map-selector'>;

    // Mobile/desktop only plugins
    distance: SveltePlugin<'distance'>;
    'watch-faces': SveltePlugin<'watch-faces'>;
    'app-review-dialog': SveltePlugin<'app-review-dialog'>;
    widgets: SveltePlugin<'widgets'>;
    garmin: SveltePlugin<'garmin'>;
    'garmin-edge': SveltePlugin<'garmin-edge'>;
    'fav-layers': SveltePlugin<'fav-layers'>;
    onboarding: SveltePlugin<'onboarding'>;
    'developer-mode': SveltePlugin<'developer-mode'>;

    'rhpane-top': SveltePlugin<'rhpane-top'>;
    rhbottom: SveltePlugin<'rhbottom'>;
    'location-permission': SveltePlugin<'location-permission'>;

    'mobile-ui': SveltePlugin<'mobile-ui'>;
    'embed-ui': SveltePlugin<'embed-ui'>;
    contextmenu: SveltePlugin<'contextmenu'>;
    upload: SveltePlugin<'upload'>;
    search: SveltePlugin<'search'>;
    'search-input': SveltePlugin<'search-input'>;
    'search-my-location': SveltePlugin<'search-my-location'>;
    'picker-mobile': SveltePlugin<'picker-mobile'>; // to Svelte plugin
    'perf-overlay': SveltePlugin<'perf-overlay'>;
    'sun-moon': SveltePlugin<'sun-moon'>;
    'wind-trajectories': SveltePlugin<'wind-trajectories'>;

    // Used as fake plugin for any other external plugin
    // basically we are unable to type each individual external plugin
    'windy-external-plugin'?: SveltePlugin<'windy-external-plugin'>;
}

export interface StartupElementPlugins {
    'startup-articles': StartupElementPlugin<'startup-articles'>;
    'startup-promos': StartupElementPlugin<'startup-promos'>;
    'startup-live-alerts': StartupElementPlugin<'startup-live-alerts'>;
    'startup-debug': StartupElementPlugin<'startup-debug'>;
    'startup-pin2hp': StartupElementPlugin<'startup-pin2hp'>;
    'startup-weather': StartupElementPlugin<'startup-weather'>;
}

export interface PlainPlugins {
    'gl-particles': Plugin<'gl-particles'>;
    isolines: Plugin<'isolines'>;
}

export interface TagPlugins {
    // These plugins have css only (no html)
    'poi-libs': TagPlugin<'poi-libs'>;
    picker: TagPlugin<'picker'>;
    globe: TagPlugin<'globe'>;
}

// Includes plain plugins
export interface Plugins
    extends TagPlugins,
        SveltePlugins,
        SveltePopupPlugins,
        SveltePanePlugins,
        PlainPlugins,
        BottomSveltePlugins,
        StartupElementPlugins {}

// Only descendants of WindowPlugin§
export interface WindowPlugins
    extends TagPlugins,
        SveltePlugins,
        SveltePopupPlugins,
        SveltePanePlugins,
        BottomSveltePlugins,
        StartupElementPlugins {}
