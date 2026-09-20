import type { Coords } from '@leafletGl';

export type ViewportBounds = { xMin: number; yMin: number; xMax: number; yMax: number };

export type TransformedUrlPayload = {
    modifiedUrl: string;
    tileCoords?: Coords;
};

export type TileDataPreprocessCallback = (
    imgData: Blob,
    urlPayload: TransformedUrlPayload,
) => Promise<ImageBitmap>;

export type GeneratedProtocol = `protocol-${string}`;

export type CustomProtocol =
    | 'rad-data'
    | 'rad-flow'
    | 'sat-data'
    | 'sat-flow'
    | 'rad-nowcast'
    | 'forecast'
    | 'rad-ptype'
    | GeneratedProtocol;
