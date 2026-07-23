/**
 * @module showMyPosition
 * @description Service to handle showing user's current position on the map.
 */
import type { Position } from '@capacitor/geolocation';
import type { GeolocationInfo } from '@windy/interfaces';
import type { GeolocationOptions } from '@windy/geolocation';
export declare const onPosition: (pos: Position | null, err?: unknown) => Promise<void>;
export declare const stop: () => void;
/**
 * My position marker can be started in two modes:
 * Permanent, from radar/sat overlays
 * Temporary, from "Show my position" button in the bottom right corner
 * Permanent overrides temporary.
 */
export declare const start: (showOnlyTemporarily?: boolean) => Promise<void>;
/**
 * Just handy shortcut to get position and display marker once
 *
 * We have to call GPS position methods twice, since start in show my position, does not return GPS
 * but internally, GPS position is requested just once (at least we hope so).
 *
 * Use this method for ad hoc getting position and displaying marker on the map, even though you
 * do not need returned position for anything else.
 */
export declare const getPositionAndDisplayMarker: (opts?: GeolocationOptions) => Promise<GeolocationInfo>;
