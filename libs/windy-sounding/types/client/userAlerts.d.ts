import type { AlertRequest, AlertResponse, AlertCheckResponse } from '@windy/alerts.d';
import type { Fav } from '@windy/favs.d';
import type { LatLon } from '@windy/interfaces';
export declare enum AlertStatus {
  Triggered = 'triggered',
  Normal = 'normal',
  Suspended = 'suspended',
}
export declare enum AlertConditionType {
  Cloudiness = 'cloudiness',
  FreshSnow = 'freshSnow',
  Rainfall = 'rainfall',
  Swell = 'swell',
  Temperature = 'temperature',
  Time = 'time',
  Wind = 'wind',
}
export declare enum Direction {
  N = 'N',
  NE = 'NE',
  E = 'E',
  SE = 'SE',
  S = 'S',
  SW = 'SW',
  W = 'W',
  NW = 'NW',
}
export declare enum Weekday {
  Monday = 'mon',
  Tuesday = 'tue',
  Wednesday = 'wed',
  Thursday = 'thu',
  Friday = 'fri',
  Saturday = 'sat',
  Sunday = 'sun',
}
/**
 * https://www.eoas.ubc.ca/courses/atsc113/flying/met_concepts/01-met_concepts/01c-cloud_coverage/index.html
 *
 * Values are meteorological convention.
 */
export declare enum CloudCoverage {
  /** No clouds */
  SkyClear = 'SKC',
  /** 1/8 to 2/8 cloud cover */
  Few = 'FEW',
  /** 3/8 to 4/8 cloud cover */
  Scattered = 'SCT',
  /** 5/8 to 7/8 cloud cover */
  Broken = 'BKN',
  /** 8/8 cloud cover */
  Overcast = 'OVC',
}
export declare function getAlertTimestamps(alertId: string): Promise<AlertCheckResponse>;
export declare function getAlertV3(alertId: string): Promise<
  Fav & {
    type: 'alert';
  }
>;
export declare function getAlerts(): Promise<AlertResponse[]>;
export declare function getAlert(alertId: string): Promise<AlertResponse | null>;
export declare function createAlert(data: AlertRequest): Promise<void>;
export declare function updateAlert(data: AlertResponse): Promise<AlertResponse>;
export declare function deleteAlert(alertId: string): Promise<void>;
export declare function getNearAlert(location: LatLon): Promise<AlertResponse | undefined>;
export declare function getNearAlerts(location: LatLon): Promise<AlertResponse[]>;
export declare function add(
  latLonAndName: LatLon & {
    locationName?: string;
  },
): void;
export declare function userHasAnyAlerts(): Promise<boolean>;
