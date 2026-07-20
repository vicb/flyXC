import type { LatLon } from '@windy/interfaces.d';
export interface NotificationExtraPayload extends LatLon {
    /** Identifier of the process in node-notif */
    processId: string;
    id: string | undefined;
    hrTimestamps: string;
    icao?: string;
    category: 'alert' | 'metar' | 'location';
    notificationId?: string;
    locationEntityId?: string;
}
export type RegistrationHash = string;
/**
 * Ask for notif permissions if missing
 *
 * @returns null | registration Hash
 */
export declare function requestPermissions(): Promise<RegistrationHash | null>;
export declare function registerDevice(): Promise<RegistrationHash | null>;
