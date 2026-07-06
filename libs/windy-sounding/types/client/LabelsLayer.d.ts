import { GridLayer, LeafletGlMap, type Coords, type GridLayerOptions } from '@leafletGl';
import type { CityDiv, CityDivId, CityLabel, CityLabelData } from './d.ts.files/LabelsLayer.d';
import type { Products } from './d.ts.files/rootScope.d';
import type { MetricIdent, MetricItem } from './d.ts.files/Metric.d';
import type { CityTemperaturesDto } from '@windy-types/citytile2';
/**
 * Leaflet layer with city labels and temperatures
 */
declare class LabelsLayer extends GridLayer<CityLabelData> {
    static defaultOptions: Required<GridLayerOptions>;
    /** Currently selected product in client */
    product?: Products;
    /** Cache of leaflet tiles with labels and temperatures */
    cityDivs: Record<CityDivId, CityDiv>;
    /** Currently selected forecast timestamp in client */
    ts: number;
    /** Whether hooks are binded (true) or not (false) */
    hasHooks: boolean;
    forecastLoaded: boolean;
    /** URL for getting label tiles */
    tilesUrl?: string;
    /** Current reftime in client */
    refTime?: string;
    /** Temperature unit */
    temperatureUnit?: MetricItem;
    constructor(options?: GridLayerOptions);
    onAdd(leafletMap: LeafletGlMap): this;
    onRemove(leafletMap: LeafletGlMap): this;
    /** Creates and stores URL for fetching label tiles */
    createTilesUrl(): void;
    /** Update labels (e.g. when language is changed) */
    updateLabels(): void;
    /**
     * Updates product name and reference time, also can fetch and update temperature data
     * @param refreshWeather Whether fetch forecast data or not (true from store event)
     */
    updateProduct(refreshWeather?: boolean): Promise<void>;
    /** Click event for labels */
    onClick(sourceEl: HTMLElement): void;
    /** TS change event whenever client's timestamp (progress bar) is changed */
    onTsChange(ts: number): void;
    /** Load new data when temperature unit is changed  */
    onMetricChanged(ident: MetricIdent, item: MetricItem): void;
    /** Update temp values for all tiles, e.g. when timestamp or metric is changed (it doesn't fetch new data from the server) */
    refreshWeather(): void;
    /** Redraw whole layer as it was first loaded */
    _reset(): void;
    /** Returns array of all cities in a form { id, el } */
    toArray(): CityLabel[];
    getCityDivs(): CityDiv[];
    /** Fetch forecast temperature data for the tile */
    loadTileForecast(tileDiv: CityDiv): void;
    /** Callback when forecast data are retrieved */
    onForecastLoaded(tileDiv: CityDiv, data: CityTemperaturesDto): void;
    protected _loadTileData(coords: Coords, abort: AbortSignal): Promise<CityLabelData | null>;
    protected _createTileContents(tileRoot: HTMLElement, coords: Coords, data: CityLabelData): void;
    /**
     * Adds DIVs with labels to the DOM, it does not fetch any data (called e.g. after retrieving labels data)
     * It does not render temperature which is appended to this div later
     */
    private renderTile;
    private getIndexToCityTileData;
    /**
     * Render forecast data for the tile, it does not fetch forecast data (called e.g. whenever refreshWeather is called)
     * Enhances DIV with data-id="id" with loaded weather.
     */
    private renderWeather;
}
export default LabelsLayer;
