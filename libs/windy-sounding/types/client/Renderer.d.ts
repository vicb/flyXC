import type { FullRenderParameters, WeatherParameters, TilePoint } from '@windy/interfaces';
import type { Timestamp, TransformFunction } from '@windy/types';
import type { Layers } from '@windy/Layer';
import type { InterpolatorFactory } from '@windy/interpolator';
import type { BottomSveltePlugins, Plugins, SveltePlugins } from '@windy/plugins.d';
export type AllowedRenderPlugins = Pick<Plugins, 'radar' | 'radar-plus' | 'cap-alerts' | 'isolines' | 'gl-particles'>;
interface DependencyModuleMap {
    radar: WPluginModules['@plugins/radar'];
    'radar-plus': WPluginModules['@plugins/radar-plus'];
    'cap-alerts': WPluginModules['@plugins/cap-alerts'];
    isolines: WPluginModules['@plugins/isolines'];
    'gl-particles': WPluginModules['@plugins/gl-particles'];
}
export type Renderers = 'tileLayer' | 'radar' | 'radarPlus' | 'capAlerts' | 'isolines' | 'particles' | 'accumulations' | 'daySwitcher' | 'noUserControl' | 'topoMap';
export interface TileParams extends TilePoint {
    url: string;
    intX: number;
    intY: number;
    trans: number;
    transformR: TransformFunction | null;
    transformG: TransformFunction | null;
    transformB: TransformFunction | null;
}
export type AllowedUserControls = keyof BottomSveltePlugins | keyof SveltePlugins | 'none';
export interface RendererInitParams {
    ident: Renderers;
    dependency?: keyof AllowedRenderPlugins;
    userControl?: AllowedUserControls;
    requiresFullRenderParams?: boolean;
}
/**
 * Renderer class acts as a proxy between renderController and code, which is responsible for
 * rendering a particular layer
 */
export declare class Renderer {
    isOpen: boolean;
    /**
     * Ident of renderer. Not used in runtime, but essential for debugging.
     * Do not remove
     */
    ident: Renderers;
    /**
     * Dependency plugin that wil be loaded before renderer is launched
     *
     * Dependency plugin can optionally export these methods:
     *
     *  - onRenderStart
     *  - onRenderEnd
     *  - paramsChanged
     *  - redraw
     *  - interpolator
     */
    dependency?: keyof AllowedRenderPlugins;
    /**
     * Loaded version of plugin dependency
     */
    loadedDependency?: DependencyModuleMap[keyof DependencyModuleMap];
    /**
     * ID of plugin, that serve as user control, which can be attached to DOM
     * usually to #plugin-bottom div.
     *
     * Contrary to dependencies, userControl is loaded after dependencies, thus NOT
     * delaying launch of whole layer.
     *
     * Any single plugin can serve both as renderer and userControl.
     *
     * In this case, make sure, that plugin, that serves as userControl
     * is duplicated as dependency.
     *
     * userControl opening and closing is handles by rndrCtrl
     */
    userControl?: AllowedUserControls;
    /** Picker interpolation factory */
    interpolator?: InterpolatorFactory;
    /** Requires FullRenderParameters */
    requiresFullRenderParams: boolean;
    constructor(params: RendererInitParams);
    private static hasProp;
    open(layerIdent: Layers, weatherParams: WeatherParameters, timestamp: Timestamp): Promise<void>;
    close(_rqrdRenderers: Renderers[]): void;
    onopen(params?: FullRenderParameters): void;
    onclose(): void;
    paramsChanged(layerIdent: Layers, weatherParams: WeatherParameters, timestamp: Timestamp): Promise<void>;
    redraw(): void;
}
export {};
