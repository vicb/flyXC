import type { RegistrationHash } from '@windy/pushNotifications';
/**
 * Deactivates current device from push notif backend
 *
 * @returns void
 */
export declare const deactivateCurrentDevice: () => Promise<void>;
/**
 * Saves info regarding current device to localStorage and to backend
 *
 * @param registrationHash Push notification registration hash
 * @returns
 */
export declare const saveCurrentDevice: (registrationHash?: RegistrationHash | null) => Promise<void>;
