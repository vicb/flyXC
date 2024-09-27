import type { ReverseResult } from '@windy/dataSpecifications.d';
import type { LatLon } from '@windy/interfaces.d';
export interface ReverseHttpPayload<IncludeIds extends boolean = false> {
  city?: string;
  country?: string;
  country_code?: string;
  county?: string;
  district?: string;
  locality?: string;
  state?: string;
  suburb?: string;
  island?: string;
  ids: IncludeIds extends true ? ReverseHttpPayload : never;
}
/**
 * Returns reverse data for given lat,lon
 *
 * @param latLon `lat` and `lon` of the place to geo reverse
 * @param forcedZoom Optionally zoom to force
 * @returns Reverse data, fallback object if anything failed
 */
export declare const get: <T extends LatLon>({ lat, lon }: T, forcedZoom?: number) => Promise<ReverseResult>;
