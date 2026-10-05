export interface PromoControls {
    showLabels: boolean;
    /**
     * Label categories that can be hidden separately. In 2D they match the category classes
     * assigned to label elements (see `labels-layer.less`), on the globe they are applied while
     * rendering labels into the label texture (see `labelCategories.ts`).
     */
    showCityLabels: boolean;
    /**
     * Importance of the city labels (the `city-1` ... `city-4` categories of the label tiles),
     * applied on top of `showCityLabels`. The importance follows the OpenStreetMap place types.
     */
    /** Capital cities and other important cities (US state capitals, Hong Kong, ...) */
    showCapitalCityLabels: boolean;
    /** Cities (OpenStreetMap `city`) */
    showBigCityLabels: boolean;
    /** Smaller towns (OpenStreetMap `town`) */
    showTownLabels: boolean;
    /** Villages (OpenStreetMap `village`) */
    showVillageLabels: boolean;
    showCountryLabels: boolean;
    /** Geographical features (oceans, seas, islands, continents, ...) */
    showGeographyLabels: boolean;
    /** Show markers (POIs) */
    showMarkers: boolean;
    /** Show Hurricane tracker labels */
    showHtLabels: boolean;
    /** Hides all GUI, only map is visible */
    hideGui: boolean;
}
