import type { LatLon } from '@windy/interfaces.d';
export interface NotificationExtraPayload extends LatLon {
  /** Identifier of the process in node-notif */
  processId: string;
  id: string | undefined;
  hrTimestamps: string;
  icao?: string;
  /**
   * Category of the notification
   *
   * - alert: forecast alert
   * - location: live alert
   * - metar: metar update
   */
  category: 'alert' | 'metar' | 'location';
  /**
   * Values used with live-alerts: storm, rain, tc, cap
   */
  subcategory: 'storm' | 'rain' | 'tc' | 'cap' | string;
  notificationId?: string;
  locationEntityId?: string;
  deviceId?: string;
}
export type RegistrationHash = string;
/**
 * Ask for notif permissions if missing
 *
 * @returns null | registration Hash
 */
export declare function requestPermissions(): Promise<RegistrationHash | null>;
export declare function registerDevice(): Promise<RegistrationHash | null>;
