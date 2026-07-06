import type { ISODateString } from '@windy/types.d';

export type ArrayBoundaries = [number, number, number, number];

export interface SatelliteInfo {
    compositeExtents: ArrayBoundaries;
    compositeMargins: ArrayBoundaries;
    dstTime: ISODateString[];
    extents: ArrayBoundaries;
    flow: string[];
    flowQuant: number;
    flowZoom: number[];
    lon: number;
    name: string;
    priority: number;
    zoom: number[];

    flowStep: number; // flow step in minutes for normalized flow tiles

    /** dateString "2021-09-09T09:00:00Z" */
    importStart: string;
    importEnd: string;

    // time interval for archive
    minDate: string;
    maxDate: string;
}

/**
 * Info Json as loaded from sat server
 */
export interface SatelliteInfoJson {
    // original content:
    token: string;
    satellites: SatelliteInfo[];
    tMax: number; // IR temperature range in tiles (optional)
    tMin: number;

    // start/end time sun filter aplied on backend (dateString: "2021-09-09T09:00:00Z")
    filterStart: string;
    filterEnd: string;

    // content added during processing:
    hash: number;
    // time interval for archive
    minDateTs: number;
    maxDateTs: number;

    updateTs: number;
    isArchive: boolean;
}
