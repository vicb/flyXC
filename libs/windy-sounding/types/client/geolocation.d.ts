import '@windy/router';
import type { GeolocationInfo, HomeLocation } from '@windy/interfaces.d';
import type { PositionOptions } from '@capacitor/geolocation';
/**
 * Returns either GPS or IP location whichever is newer.
 *
 * If none is available, returns fallback location. Although this method
 * provides just a basic, very approximate location it is sync and can be used
 * without user's GPS location permission.
 *
 * @returns Location got from GPS or IP, the newer is preferred
 */
export declare const getMyLatestPos: () => GeolocationInfo;
interface GeolocationOptions extends PositionOptions {
  doNotShowSearchGPSMessage?: boolean;
  doNotShowFailureMessage?: boolean;
  getMeFallbackGps?: boolean;
}
/**
 * Returns promise on GPS based location with GeoIP location as a fallback.
 *
 * Enables to display information messages to user by default, and enables to
 * get fallback GPS location if GPS location is not available.
 *
 * @param options Options for geolocation
 * @returns Geolocation info from GPS, GeoIP as a fallback
 */
export declare const getGPSlocation: (options?: GeolocationOptions) => Promise<GeolocationInfo>;
/**
 * Returns fallback name created from lat,lon if nothing else can be used
 *
 * @param lat Latitude
 * @param lon Longitude
 * @returns Fallback location name in a format "49.15, 14.18"
 *
 * @ignore
 */
export declare const getFallbackName: (lat: number | string, lon: number | string) => string;
/**
 * Gets accurate home location. Cannot be used in map initialization because it is async.
 * @ignore
 */
export declare const getHomeLocation: () => Promise<GeolocationInfo | HomeLocation>;
export declare function requestLocationPermissions(): Promise<boolean>;
export {};
