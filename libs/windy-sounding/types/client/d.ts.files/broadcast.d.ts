/*
    Overall broadcasted events. We have used loose coupled components
    system before TS was used.

    Now it is better to use close coupled components, with strong type control

    TODO: Minimize amount of these events and reduce their usage

*/

import { Evented } from '@windy/Evented';
import { MetricIdent, MetricItem } from '@windy/Metric.d';
import { PluginIdent } from '@windy/Plugin';
import { NotificationPreferences } from '@windy/dataSpecifications.d';
import {
    GeolocationInfo,
    LatLon,
    WeatherParameters,
    type FullRenderParameters,
} from '@windy/interfaces.d';
import { PluginSource, PluginsOpenParams, PluginsQsParams } from '@windy/plugin-params.d';
import { Plugins } from '@windy/plugins.d';
import { Pois } from '@windy/rootScope.d';
import type { ExternalPluginIdent } from '@windy/types';
import type { ZoomOptions } from '@leafletGl';
import type { RadarPlusLayer } from '@plugins/radar-plus/types';
import type { ParsedStartupValues } from '@windy/router';
import type { ParsLocation as GlobeParsLocation } from '@plugins/globe/main/receiver.d';
import type { Params as GlobeParams, Poi as GlobePoi } from '@plugins/globe/types.d';
import type { ExtendedDataAndParams } from '@plugins/isolines/IsolinesCanvas2D.d';

type BcastTypesNonGeneric = {
    /**
     * @ignore
     */
    [key in `globe-poi-${Pois}`]: [HTMLElement | null, NonNullable<GlobePoi>];
};

/**
 * # @windy/broadcast
 *
 *  Major Windy's event emitter (instance of class {@link Evented.Evented | Evented }), used for announcing the most important events.
 *
 * @example
 * ```js
 * import broadcast from '@windy/broadcast';
 *
 * const listener = params => console.log('Params has changed', params);
 *
 * broadcast.on('redrawFinished', listener );
 *
 * broadcast.once('metricChanged', params => {
 *     // This method will be called just once
 * });
 *
 * // Do not forget to unsubscribe any listener
 * broadcast.off('redrawFinished', listener);
 *
 * // Let's fire some event
 * broadcast.emit('rqstOpen', 'menu');
 * ```
 */
export interface BasicBcastTypes<T extends keyof Plugins> {
    /**
     * Basically most important broadcast of all, triggered just once,
     * when Windy.com has been successfully loaded and all modules are ready
     * to be consumed
     */
    dependenciesResolved: [];

    /** Request to open plugin (either internal or external) */
    rqstOpen: [T | string, PluginsOpenParams[T] | undefined];

    /** Request to close plugin (either internal or external) */
    rqstClose: [T | string];

    /** Request to close all opened plugins (unless plugin has noClose property) */
    closeAllPlugins: [PluginIdent] | [];

    /** Plugin was successfully loaded and closed */
    pluginClosed: [PluginIdent | string];

    /** Plugin was successfully closed */
    pluginOpened: [PluginIdent | string];

    /**
     * Triggered when Windy has successfully loaded and rendered requested data.
     * Use this for triggering your own tasks.
     */
    redrawFinished: [WeatherParameters | null];

    /**
     * Forces various renderers to render layers, for example after
     * reconfiguring color gradient, or changing particle animation settings.
     */
    redrawLayers: [{ noCache: boolean }] | [];

    /**
     * When user changes some parameters (overlay, level, date etc...).
     * Do not not use this event to start any intensive action since Windy now
     * must load and render all the data. We recommend to use `redrawFinished` instead.
     */
    paramsChanged: [WeatherParameters, keyof WeatherParameters | 'path' | undefined];

    /**
     * Indicates that user changed any of the units (wind, temp, ...).
     */
    metricChanged: [MetricIdent | undefined, MetricItem | undefined];

    /** Indicates that user added, removed or rename his fav  */
    favChanged: [];

    /** Indicates that user added, removed or rename his alert  */
    alertChanged: [];

    /** Indicates that user added or removed external plugin */
    externalPluginChanged: [];

    /**
     * Indicates that router has parsed new route,
     * used to trigger opening plugins based on url
     */
    routerParsed: [PluginIdent | ExternalPluginIdent | void, ParsedStartupValues | undefined];

    /**
     * Indicates that mobile ui of plugin using BottomSlide was half opened
     */
    pluginHalfOpened: [PluginIdent, boolean];

    /**
     * Request to half open plugin, used in BottomSlide
     */
    rqstHalfOpen: [ident: PluginIdent, value: boolean | undefined, emit: boolean | undefined];

    // prettier-ignore
    /** @ignore */ globeOpened: [];
    /** @ignore */ globeClose: [];
    /** @ignore */ globeFailed: [];

    /** @ignore */ 'globe-detail': [LatLon & PluginSource];
    /** @ignore */ 'globe-isolines': [ExtendedDataAndParams | null];
    /** @ignore */ 'globe-poi': [GlobeParsLocation & { type?: string; id?: string }];
    /** @ignore */ 'globe-zoomIn': [[number, number] | null] | [];
    /** @ignore */ 'globe-zoomOut': [[number, number] | null] | [];
    /** @ignore */ 'globe-paramsChanged': [GlobeParams];

    /** @ignore */ 'leafletGl-zoomIn': [number | undefined, ZoomOptions | undefined];
    /** @ignore */ 'leafletGl-zoomOut': [number | undefined, ZoomOptions | undefined];
    /** @ignore */ 'leafletGl-paramsChanged': [
        WeatherParameters,
        keyof WeatherParameters | undefined,
    ];

    /** @ignore */ 'radarPlus-open-layer': [RadarPlusLayer, boolean | undefined]; // Layer to open, whether to open layer for color editing
    /** @ignore */ detailClose: [];
    /** @ignore */ detailRendered: []; // used only in embed indicates that detail is ready
    /** @ignore */ stationRendered: []; // used only in embed indicates that detail is ready
    /** @ignore */ reloadFavs: [];
    /** @ignore */ notifPrefChanged: [NotificationPreferences | undefined];
    /** @ignore */ satBackupReload: [];
    /** @ignore */ promptSavePassword: [];
    /** @ignore */ onResume: [];
    /** @ignore */ back2home: [];
    /** @ignore */ reloadMobileApp: [];
    /** @ignore */ newLocation: [GeolocationInfo];
    /** @ignore */ checkPendingSubscriptions: [];
    /** @ignore */ loadingFailed: [string];
    /** @ignore */ zoomIn: [];
    /** @ignore */ zoomOut: [];
    /** @ignore */ showSocialError: [string];
    /** @ignore */ openapp: [];
    /** @ignore */ openSearch: [];
    /** @ignore */ renderersUpdated: []; // Fired once all renderers have had their params updated.
    /** @ignore */ tileLayerParamsChanged: [FullRenderParameters];
    /** @ignore */ glContextLost: [];
    /** @ignore */ glContextRestored: [];
    /** @ignore */ glRestoreContext: [];
    /** @ignore */ glLoseContext: [];
}

interface BcastTypes<T extends keyof Plugins> extends BcastTypesNonGeneric, BasicBcastTypes<T> {}

/** @ignore */
export type BcastEventsWithoutParams<T extends keyof Plugins> = keyof Pick<
    BcastTypes<T>,
    { [K in keyof BcastTypes<T>]: [] extends BcastTypes<T>[K] ? K : never }[keyof BcastTypes<T>]
>;

/** @ignore */
export class Broadcast extends Evented<BcastTypes<keyof Plugins>> {
    // emitting `rqstOpen` is quite complicated for TS, simplify it with multiple definition
    emit<K extends keyof Omit<BcastTypes<keyof Plugins>, 'rqstOpen'>>(
        this: this,
        topic: K,
        ...data: TrimUndefinedFromRight<Arrayify<BcastTypes<keyof Plugins>[K]>>
    ): void;

    emit<P extends string>(
        this: this,
        topic: 'rqstOpen',
        pluginName: P,
        params?: PluginsOpenParams[P],
        qs?: PluginsQsParams[P],
    ): void;
}
