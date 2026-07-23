export type SatelliteRangeJson = {
    maxDate: string;
    minDate: string;
    step: number;
};

export type SatellitePreprocessParams = {
    tileCoords: number[];
    timestamp: number;
    satModeParams: Float32Array;
};

export type SatelliteChannel = 'IR' | 'VIS';

// Frame updateStart timestamp | frame last updated timestamp
// e.g.: ["2021-09-09T09:15:00Z", "2021-09-09T09:16:24Z"]
export type FlowFramePair = [string, string];
export type Source = { sat: string; frame_time: string };
export type ImageFrameInfo = { frame_time: string; update_time: string; sources: Source[] };

export type SatelliteProviderInfo = {
    logo: string;
    name: string;
    url: string;
};

export type SatelliteInfo = {
    extents: [number, number, number, number];
    name: string;
    provider: SatelliteProviderInfo;
};

export type CompositeGroup = {
    name: string;
    members: string[];

    /** Name of the region, if empty, the region is considered as testing region, ig */
    outage_region: string;
};

export interface SatelliteCompositeJson {
    /** Resolution of the age map values (mapping between raster values [0-255] of age map and seconds representing tile age) */
    age_map_resolution: number;

    /** Which channels are available in the composite (typically VIS and IR) */
    channels: SatelliteChannel[];

    /** Groups of composite sources (satellites) */
    composite_groups: CompositeGroup[];

    /** Quantization factor for flow values (+- similar functionality as age_map_resolution) */
    flow_quant_factor: number;

    /** Step in minutes for which flow vectors are computed */
    flow_step: number;

    /** Zoom levels for which flow tiles are available  on BE*/
    flow_zooms: number[];

    /** Timestamps for which flow data is available */
    flows: FlowFramePair[];

    /** Array with per-frame structured information of available images (timestamps to load data tiles) */
    images: ImageFrameInfo[];

    /** Satellites metadata */
    satellites: SatelliteInfo[];

    /** IR temperature range in tiles */
    t_max: number;
    t_min: number;

    /** Interval between frames in minutes */
    step: number;
    version: number;

    /** Max data zoom */
    zoom: number;
    hash?: number;
}
