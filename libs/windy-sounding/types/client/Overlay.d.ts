import type { Layers } from '@windy/Layer';
import type { Metric } from '@windy/Metric';
import type { DirectionFunction } from '@windy/format.d';
import type { Iconfont } from '@windy/iconfont.d';
import type { Overlays } from '@windy/rootScope.d';
import type { RGBNumValues } from '@windy/interpolatorTypes';
import type { LoadedTranslations, HTMLString, RGBString } from '@windy/types';
import type { Color } from '@windy/Color';
import type { Legend, DiscreteLegend } from '@windy/legends.d';
export type UsedOverlays = Overlays | 'swell';
export type OverlayInitParams = Pick<Overlay, 'ident' | 'icon' | 'trans'> & Partial<Overlay>;
export declare class Overlay {
    /**
     * Main ident
     */
    ident: Overlays;
    /**
     * Translation string
     */
    trans: keyof LoadedTranslations;
    /**
     * Shortened version of translation string
     *
     * Used only on fav overlays in desktop. It is worth to
     * fill only for overlays with long names, that are used
     * as a default fav overlay in desktop.
     */
    transShort?: keyof LoadedTranslations;
    /**
     * Overlay has more levels
     */
    hasMoreLevels?: boolean;
    /**
     * Icon used in menus and such
     */
    icon: Iconfont;
    /**
     * Layers used
     */
    layers?: Layers[];
    /**
     * Is the overlay supported in globe mode. Default: false
     */
    globeNotSupported: boolean;
    /**
     * POI cities behavior:
     * - 'full': show city markers with interpolated weather values (default)
     * - 'markers': show city markers without weather values (e.g. waves, discrete overlays)
     * - 'none': disable POI cities entirely (e.g. radar, satellite)
     */
    poiCities: 'full' | 'markers' | 'none';
    /**
     * Hide elevation in the desktop picker
     */
    hidePickerElevation?: boolean;
    /**
     * Eg. in day-switcher we need as short name as possible
     */
    shortname?: string;
    /**
     * Eg. in overlays gallery it is needed to have more specific name of the layer
     */
    fullname?: string;
    /**
     * When overlay represents group of other layers, this can be used to get the whole group menu icon independently from the layer
     */
    menuIcon?: Iconfont;
    /**
     * When overlay represents group of other layers, this can be used to name the whole group in menu independently from the layer
     */
    menuTrans?: keyof LoadedTranslations;
    /**
     * Hide overlay from listing in all the menus
     */
    partOf?: Overlays;
    /**
     * Hides particle on/off switch in GUI (so far used only in desktop GUI)
     */
    hideParticles?: boolean;
    /**
     * Given overlay display accumulation
     */
    isAccu?: boolean;
    /**
     * allwaysOn
     */
    allwaysOn?: boolean;
    /**
     * Whether the overlay can be synchronized with the detail plugin timeline.
     * False for non-forecast overlays like radar, satellite, accumulations, etc.
     */
    disableSyncWithDetail: boolean;
    /**
     * Programatically injected properties from particulat Metric instance
     * by defaul we consider that these Metrics are NUmberedMetrics only (for
     * simplicity of implementation) and string metrics legends and picker are
     * handled by its overloaded methods
     */
    convertValue: Metric['convertValue'];
    convertNumber: Metric['convertNumber'];
    setMetric: Metric['setMetric'];
    cycleMetric: Metric['cycleMetric'];
    listMetrics: Metric['listMetrics'];
    /**
     * Main metric associated with this overlay
     */
    overlayMetric: Metric;
    /**
     * Main color associated with this overlay (used in legend if applicable)
     */
    overlayColor: Color;
    /**
     * Alternative legend that can overload the legend used in metric
     */
    alternativeLegend?: Legend | DiscreteLegend;
    /**
     * Do not display this overlay in URL
     */
    hideFromURL?: boolean;
    /**
     * Optional promo badge to be displayed in GUI
     */
    promoBadge?: string;
    promoBadgeColor?: RGBString;
    /**
     * Optional menu image thumbnail
     */
    menuImage?: string;
    /**
     * Show a second picker row with ECMWF wind (speed + direction). Used by the
     * fire-danger overlays.
     */
    windCompanionRow?: boolean;
    constructor(params: OverlayInitParams);
    /**
     * When clicking on overlay in menu, do the following action (ready to be overloaded)
     */
    onClick(): void;
    /**
     * Render's overlay's legend inside el
     */
    paintLegend(el: HTMLDivElement): void;
    /**
     * Return translated description of overlay
     *
     * @param short If true, return shortened version of description if avail
     */
    getName(short?: boolean): string;
    /**
     * Return URL of image for overlay
     */
    getMenuImagePath(): string;
    /**
     * Get menu title
     *
     * @param short If true, return shortened version of description if avail
     */
    getMenuName(short?: boolean): string;
    /**
     * Return ident of menu item (usualy `ident` but some inner overlays has `partOf` and are not directly in menu)
     */
    getMenuIdent(): Overlays;
    /**
     * Create part of inner text of picker
     * @param values Interpolated values
     */
    createPickerHTML(values: RGBNumValues, _directionFormattingFunction: DirectionFunction): HTMLString;
    /**
     * Just proxy to the Metric's metric property
     * @deprecated Change to getMetric() and remove this getter
     */
    get metric(): "" | import("./Metric").MetricItem;
    protected initProperties(): void;
}
