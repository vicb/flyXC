import type { Color } from '@windy/Color';
import type { Metric } from '@windy/Metric';
import type { Legend } from '@windy/Metric.d';
import type { DataQuality, FileSuffix } from '@windy/Product';
import type { Renderers } from '@windy/Renderer';
import type { Levels, Products } from '@windy/rootScope.d';
import type { NumberedMetric, PrecipMetric, PtypeMetric, UVIndexMetric } from '@windy/MetricClasses';
import type { TransformFunction } from '@windy/types';
import type { RenderParams } from '@windy/interfaces';
/**
 * All available layers and their metric value type
 */
export interface LayerMetricType {
    capAlerts: undefined;
    pressureIsolines: undefined;
    ghIsolines: undefined;
    tempIsolines: undefined;
    deg0Isolines: undefined;
    windParticles: undefined;
    ecmwfWindParticles: undefined;
    ecmwfWindParticles150h: undefined;
    ecmwfWindParticles500h: undefined;
    ecmwfWindParticles600h: undefined;
    waveParticles: undefined;
    waveParticlesWaves: undefined;
    currentParticles: undefined;
    currentsTideParticles: undefined;
    wind: NumberedMetric;
    temp: NumberedMetric;
    wetbulbtemp: NumberedMetric;
    solarpower: NumberedMetric;
    wavePower: NumberedMetric;
    uvindex: UVIndexMetric;
    dewpoint: NumberedMetric;
    gust: NumberedMetric;
    gustAccu: NumberedMetric;
    rh: NumberedMetric;
    pressure: NumberedMetric;
    ccl: NumberedMetric;
    rain: PrecipMetric;
    ptype: PtypeMetric;
    thunder: NumberedMetric;
    clouds: NumberedMetric;
    lclouds: NumberedMetric;
    mclouds: NumberedMetric;
    hclouds: NumberedMetric;
    cape: NumberedMetric;
    cbase: NumberedMetric;
    fog: NumberedMetric;
    snowAccu: NumberedMetric;
    rainAccu: NumberedMetric;
    waves: NumberedMetric;
    wwaves: NumberedMetric;
    swell1: NumberedMetric;
    swell2: NumberedMetric;
    swell3: NumberedMetric;
    swell: NumberedMetric;
    currents: NumberedMetric;
    currentsTide: NumberedMetric;
    sst: NumberedMetric;
    visibility: NumberedMetric;
    snowcover: NumberedMetric;
    cloudtop: NumberedMetric;
    deg0: NumberedMetric;
    cosc: NumberedMetric;
    dustsm: NumberedMetric;
    radar: NumberedMetric;
    satellite: NumberedMetric;
    gtco3: NumberedMetric;
    pm2p5: NumberedMetric;
    no2: NumberedMetric;
    aod550: NumberedMetric;
    tcso2: NumberedMetric;
    go3: NumberedMetric;
    gh: NumberedMetric;
    efiWind: NumberedMetric;
    efiTemp: NumberedMetric;
    efiRain: NumberedMetric;
    moistureAnom40: PrecipMetric;
    moistureAnom100: PrecipMetric;
    drought40: NumberedMetric;
    drought100: NumberedMetric;
    soilMoisture40: NumberedMetric;
    soilMoisture100: NumberedMetric;
    fwi: NumberedMetric;
    dfm10h: NumberedMetric;
    turbulence: NumberedMetric;
    icing: NumberedMetric;
    topoMap: undefined;
    aqi: NumberedMetric;
}
/**
 * All layers available
 */
export type Layers = keyof LayerMetricType;
type LayerInitParams = Pick<Layer, 'ident'> & Partial<Layer>;
export declare class Layer<M extends Metric | undefined = Metric | undefined> {
    /**
     * Colors instance(s) used for this overlay
     */
    c: Color;
    /**
     * Metric instances used for this overlay
     */
    m: M extends Metric ? M : undefined;
    /**
     * Alternative legend
     */
    l?: Legend;
    /**
     * Layer identifier (used for metric settings) since some overlays are just pointers to
     * other overlays, identifier can be same for more overlays.
     */
    ident: Layers;
    /**
     * Standard renderer ident
     */
    renderer: Renderers;
    /**
     * If set replaces overlay as filename for particular file path
     */
    filename?: string;
    /**
     * If true applies "sea" class to body tag which influencess way, the globe is displayed
     */
    sea: boolean;
    /**
     * If defined overwrites data precision quality of product
     */
    dataQuality: DataQuality;
    /**
     * If set overrides file suffix of product
     */
    fileSuffix: FileSuffix;
    /**
     * Blue channel defines transparency
     */
    JPGtransparency: boolean;
    /**
     * PNG file with defined transparency
     */
    PNGtransparency?: boolean;
    /**
     * Overrides product's maxTileZoom
     */
    maxTileZoom?: {
        free: number;
        premium: number;
    };
    /**
     * These properties are passed directlly to renderer
     */
    renderParams: RenderParams;
    /**
     * Overrides param's product
     */
    product?: Products;
    /**
     * Overrides products or params levels
     */
    levels: Levels[];
    /**
     * Optional query string that enhances query string
     */
    query?: string;
    /**
     * webGL transformation
     */
    wTransformR?: number | 'rainLog';
    /**
     * What is this? webGL or Globe hasParticles?
     */
    hasParticles?: boolean;
    /**
     * Metrics to use in color settings
     * If users opts to change colors of this layer, use this metrics
     */
    cm?: Metric;
    /**
     * Method to transfrom value in R channel
     */
    transformR?: TransformFunction;
    /**
     * Method to transfrom value in G channel
     */
    transformG?: TransformFunction;
    /**
     * Method to transfrom value in B channel
     */
    transformB?: TransformFunction;
    constructor(params: LayerInitParams);
    /**
     * Just calls Color's getColor() method
     */
    getColor(): ReturnType<Color['getColor']>;
    /**
     * getColor for layers, with mutliple colors (like rainClouds)
     */
    getColor2?(): ReturnType<Color['getColor']>;
    /**
     * Return amounts of dots, based on rain
     */
    getAmountByColor?(Rf: number, Gf: number): 0 | 1 | 2 | 3 | 4;
    protected initProperties(): void;
}
export {};
