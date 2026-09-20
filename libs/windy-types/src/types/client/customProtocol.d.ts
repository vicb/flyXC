import type { CustomProtocol, TileDataPreprocessCallback, TransformedUrlPayload } from '@windy/mapUtils.d';
/**
 * @summary Registers custom protocol to the maplibre, which tells maplibre that we would like to take responsibility for fetching these tiles
 *  - this is useful when we want to modify the original tile request url etc.
 *  - for example to inject additional parameters such as timestamp, satellite key etc., since maplibre supports only {x}/{y}/{z} parameters
 * @param protocol Placeholder protocol (e.g. "myProtocol") which is set to the tile url instead of the standard http/https protocol and which is used by maplibre to differentiate between tiles to be intercepted
 * @param urlTransformCallback Callback function to be called for each intercepted tile request
 *   - the provided callback should take two parameters (the current tile url and the custom protocol) and should output valid tile url or empty string in case the tile should be aborted
 * @param usePlaceholderImage Whether to use "no-data" placeholder tile in case the original tile could not be loaded
 */
export declare function registerCustomTileProtocol(protocol: CustomProtocol, urlTransformCallback: (url: string, protocol: string) => TransformedUrlPayload, tilePreprocessCallback?: TileDataPreprocessCallback, fallbackImageData?: ArrayBuffer, replaceEmpty?: boolean): void;
