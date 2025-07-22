import { AlertConditionType, CloudCoverage, AlertStatus, Direction, Weekday } from '@windy/userAlerts';
import type { Timestamp, UserInterest } from '@windy/types';
import type { Products } from '@windy/rootScope.d';
import type { LatLon } from '@windy/interfaces';

export interface AlertRequest {
  conditions: AlertCondition[];
  description: string;
  favToDeleteId?: string;
  lat: number;
  locationName: string;
  lon: number;
  model: GlobalProductWithWaves | null;
  priority?: number;
  suspended: boolean;
  userInterest: UserInterest;
  hasCustomDescription?: boolean;
}

export type GlobalProductWithWaves = Extends<Products, 'ecmwf' | 'gfs' | 'icon' | 'mblue'>;

export interface AlertCheckResponse {
  /**
   * Array of timestamps when the trigger is triggered
   */
  timestamps: Timestamp[];
}

export interface NumberRange {
  from: number;
  to: number;
}

export interface AlertConditionBase {
  type: AlertConditionType;
}

export interface CloudinessAlertCondition extends AlertConditionBase {
  type: AlertConditionType.Cloudiness;
  cloudCoverage: CloudCoverage[];
}

export interface FreshSnowAlertCondition extends AlertConditionBase {
  rangeCentimeters: NumberRange;
  type: AlertConditionType.FreshSnow;
}

export interface RainfallAlertCondition extends AlertConditionBase {
  hours: number;
  rangeMilliliters: NumberRange;
  type: AlertConditionType.Rainfall;
}

export interface SwellAlertCondition extends AlertConditionBase {
  directions: Direction[];
  rangeSwellMeters: NumberRange;
  type: AlertConditionType.Swell;
}

export interface TemperatureAlertCondition extends AlertConditionBase {
  rangeKelvin: NumberRange;
  type: AlertConditionType.Temperature;
}

export interface TimeAlertCondition extends AlertConditionBase {
  /** Days of the week in which the conditions must be met */
  days: Weekday[];
  /** Hours of the day in which the conditions must be met */
  hours?: NumberRange[];
  /** Minimum duration of meeting the conditions to send the notification */
  minDurationHours: number;
  /** Range of days which will be checked for conditions */
  rangeDays?: NumberRange;
  type: AlertConditionType.Time;
}

export interface WindAlertCondition extends AlertConditionBase {
  directions: Direction[];
  rangeWindMetersPerSecond: NumberRange;
  type: AlertConditionType.Wind;
}

export type AlertCondition =
  | CloudinessAlertCondition
  | FreshSnowAlertCondition
  | RainfallAlertCondition
  | SwellAlertCondition
  | TemperatureAlertCondition
  | TimeAlertCondition
  | WindAlertCondition;

/** MongoDb id of the alert */
export type AlertId = string;

export interface AlertResponse extends AlertRequest {
  created: Timestamp;
  updated: Timestamp;
  id: AlertId;
}

/** Group with multiple alerts in it */
export interface AlertGroupObject extends LatLon {
  key: string;
  locationName: string;
  priority: number;
  alerts: AlertResponse[];
}

/** Enhanced Alert */
export interface EnhancedAlert extends AlertResponse {
  status: AlertStatus;
  timestamps: Timestamp[];
}
