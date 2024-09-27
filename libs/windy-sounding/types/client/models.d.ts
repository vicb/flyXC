import type { Layers } from '@windy/Layer.d';
import type { UsedOverlays } from '@windy/Overlay';
import type { LatLon } from '@windy/interfaces.d';
import type { Overlays, PointProducts, Products } from '@windy/rootScope.d';
type LayerOrOverlay = Layers | UsedOverlays;
/**
 * Layer <--> product relations
 */
export declare const layer2product: {
  [P in LayerOrOverlay]?: Products[];
};
/**
 * Overlay <--> product relations
 */
export declare const overlay2product: {
  [P in LayerOrOverlay]?: Products[];
};
/**
 * From list of products deduplicates icon/iconEu, iconWaves/iconEuWaves
 */
export declare const dedupeIcon: (productsList: Products[]) => Products[];
/**
 * Return particular icon related model based on rqrd and avbl models
 */
export declare const getIconModel: (rqrdProduct: Products, avProducts: Products[]) => Products | null;
/**
 * Return idents of visible local products available in the current map boundaries (or empty array undefined)
 */
export declare const betterProducts: <
  T extends LatLon,
  PT extends boolean,
  R extends PT extends true
    ?
        | 'icon'
        | 'gfs'
        | 'ecmwf'
        | 'ecmwfAifs'
        | 'namConus'
        | 'namHawaii'
        | 'namAlaska'
        | 'iconEu'
        | 'iconD2'
        | 'arome'
        | 'aromeAntilles'
        | 'aromeReunion'
        | 'canHrdps'
        | 'canRdwpsWaves'
        | 'iconEuWaves'
        | 'hrrrAlaska'
        | 'hrrrConus'
        | 'bomAccess'
        | 'ukv'
        | 'jmaMsm'
        | 'jmaCwmWaves'
        | 'mblue'
    :
        | 'icon'
        | 'satellite'
        | 'radar'
        | 'drought'
        | 'capAlerts'
        | 'gfs'
        | 'ecmwf'
        | 'ecmwfAnalysis'
        | 'ecmwfAifs'
        | 'ecmwfWaves'
        | 'gfsWaves'
        | 'iconWaves'
        | 'cams'
        | 'efi'
        | 'cmems'
        | 'fireDanger'
        | 'activeFires'
        | 'nems'
        | 'namConus'
        | 'namHawaii'
        | 'namAlaska'
        | 'iconEu'
        | 'iconD2'
        | 'arome'
        | 'aromeAntilles'
        | 'aromeReunion'
        | 'canHrdps'
        | 'canRdwpsWaves'
        | 'camsEu'
        | 'iconEuWaves'
        | 'hrrrAlaska'
        | 'hrrrConus'
        | 'bomAccess'
        | 'ukv'
        | 'jmaMsm'
        | 'jmaCwmWaves'
        | 'mblue',
>(
  latLon: T,
  pointFcts?: PT,
) => R[];
/**
 * Return product string on a basis of overlay & wanted forecast model
 */
export declare const getProduct: (overlay: Overlays, rqrdProduct: Products) => Products;
/**
 * Returns all AIR products for point forecast in given location
 */
export declare const getAllPointProducts: <T extends LatLon>(latLon: T) => PointProducts[];
/**
 * Returns dedupped AIR products for point forecast in given location
 */
export declare const getPointProducts: <T extends LatLon>(latLon: T) => Products[];
export {};
