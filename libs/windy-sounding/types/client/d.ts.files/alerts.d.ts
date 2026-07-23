import { AlertConditionType, CloudCoverage, AlertStatus, Direction, Weekday } from '@windy/userAlertsEnums';
import type { Timestamp, UserInterest } from '@windy/types';
import type { Products } from '@windy/rootScope.d';
import type { LatLon } from '@windy/interfaces';
import type { pollenProducts } from '@windy/rootScope';

export type AlertType = 'forecast' | 'live';

/**
 * Per-service settings for a fixed-location live alert.
 */
export interface LiveAlertServices {
  storms?: {
    enabled: boolean;
  };
  rain?: {
    enabled: boolean;
  };
  tc?: {
    enabled: boolean;
  };
  cap?: {
    enabled: boolean;
  };
}

/**
 * Fields shared by every alert request regardless of type. Mirrors the
 * backend's `BaseAlert` class — `userInterest`, `model`, and
 * `hasCustomDescription` live here as optional because both forecast and
 * live records can carry them on the wire (the backend keeps them on the
 * shared base). For forecast alerts, `ForecastAlertRequest` narrows
 * `model` to required, since the wizard always sets it.
 */
export interface AlertRequestBase {
  description: string;
  favToDeleteId?: string;
  hasCustomDescription?: boolean;
  lat: number;
  locationName: string;
  lon: number;
  /**
   * No longer user-picked for new alerts (the Activity step is being
   * removed); kept optional for backward compat.
   */
  userInterest?: UserInterest;
  /**
   * Forecast model. Optional on the base because the backend allows it
   * to be absent on any record; `ForecastAlertRequest` narrows it to
   * required.
   */
  model?: GlobalProductWithWaves | null;
  priority?: number;
  suspended: boolean;
}

export interface ForecastAlertRequest extends AlertRequestBase {
  type: 'forecast';
  conditions: AlertCondition[];
  model: GlobalProductWithWaves | null;
}

export interface LiveAlertRequest extends AlertRequestBase {
  type: 'live';
  services: LiveAlertServices;
}

/** Discriminated union of all alert request payloads. */
export type AlertRequest = ForecastAlertRequest | LiveAlertRequest;

export interface ForecastAlertResponse extends ForecastAlertRequest {
  id: AlertId;
}

export interface LiveAlertResponse extends LiveAlertRequest {
  id: AlertId;
}

/** Discriminated union of all alert response records. */
export type AlertResponse = ForecastAlertResponse | LiveAlertResponse;

/**
 * Shape that includes legacy records.
 *
 * Older alerts were created without a `type` field. The read path converts
 * them to `Alert` using `normalizeAlertType`
 */
export type StoredAlert = AlertResponse | (Omit<ForecastAlertResponse, 'type'> & { type?: undefined });

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

export type Validated<T> = T & {
  valid: boolean;
};

export interface AqiAlertCondition extends AlertConditionBase {
  rangeAqi: NumberRange;
  type: AlertConditionType.Aqi;
}

export interface CloudinessAlertCondition extends AlertConditionBase {
  type: AlertConditionType.Cloudiness;
  cloudCoverage: CloudCoverage[];
}

export interface FreshSnowAlertCondition extends AlertConditionBase {
  rangeCentimeters: NumberRange;
  type: AlertConditionType.FreshSnow;
}

interface PollenTypeSetting {
  enabled: boolean;
}

type PollenSelection = Partial<Record<keyof typeof pollenProducts, PollenTypeSetting>>;

export interface PollenAlertCondition extends AlertConditionBase {
  pollens: PollenSelection;
  type: AlertConditionType.Pollen;
}

export interface RainfallAlertCondition extends AlertConditionBase {
  hours: number;
  rangeMillimeters: NumberRange;
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
  | AqiAlertCondition
  | CloudinessAlertCondition
  | FreshSnowAlertCondition
  | PollenAlertCondition
  | RainfallAlertCondition
  | SwellAlertCondition
  | TemperatureAlertCondition
  | TimeAlertCondition
  | WindAlertCondition;

/** MongoDb id of the alert */
export type AlertId = string;

/** Group with multiple alerts in it */
export interface AlertGroupObject extends LatLon {
  key: string;
  locationName: string;
  priority: number;
  alerts: AlertResponse[];
}

/** Alert decorated with computed status and triggered timestamps. */
export type EnhancedAlert = AlertResponse & {
  status: AlertStatus;
  timestamps: Timestamp[];
};
