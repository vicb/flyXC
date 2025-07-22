import type { LatLon } from '@windy/interfaces';
import type { Overlays, Products, Pois, Levels } from '@windy/rootScope.d';
import type { DetailDisplayType, StationId, Timestamp } from '@windy/types';
export type QueryStringImakerParams = LatLon & {
  zoom: number;
  overlay?: Overlays;
  level?: Levels;
  displayPressureIsolines?: boolean;
  product?: Products;
  pois?: Pois;
  timestamp?: Timestamp;
} & (
    | {
        type: 'map';
      }
    | {
        type: 'detail';
        detailDisplay?: DetailDisplayType;
        detailProduct?: Products;
        /** Can be absolute or relative number (for debugging purposes) */
        moveToTimestamp?: Timestamp;
      }
    | {
        type: 'station';
        /** Format is the same as used in URL, for example `wmo-1158` */
        stationId: StationId;
        /** Can be absolute or relative number (for debugging purposes) */
        moveToTimestamp?: Timestamp;
      }
  );
export interface RenderMapParams extends LatLon {
  zoom: number;
  overlay?: Overlays;
  level?: Levels;
  displayPressureIsolines?: boolean;
  displayParticles?: boolean;
  product?: Products;
  pois?: Pois;
  timestamp?: Timestamp;
}
export interface RenderDetailParams extends RenderMapParams {
  detailDisplay?: DetailDisplayType;
  detailProduct?: Products;
  /** Can be absolute or relative number (for debugging purposes) */
  moveToTimestamp?: Timestamp;
}
export interface RenderStationParams extends RenderMapParams {
  stationId: StationId;
  moveToTimestamp?: Timestamp;
}
export declare const renderMap: (params: RenderMapParams) => Promise<string[]>;
export declare const renderDetail: (params: RenderDetailParams) => Promise<string[]>;
export declare const renderStation: (params: RenderStationParams) => Promise<string[]>;
