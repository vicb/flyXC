import type { LatLon } from '@windy/interfaces.d';
export interface NotificationExtraPayload extends LatLon {
  /** Identifier of the process in node-notif */
  processId: string;
  id: string | undefined;
  hrTimestamps: string;
  icao?: string;
  category: 'alert' | 'metar';
  notificationId?: string;
  locationEntityId?: string;
}
export type RegistrationHash = string;
export declare function registerDevice(): Promise<RegistrationHash | null>;
