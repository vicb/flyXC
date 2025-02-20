import type { NotificationExtraPayload } from './d.ts.files/pushNotifications';
import type { HttpPayload } from './d.ts.files/http';
export declare const canReceiveNotifications: Promise<void>;
export declare function loadNotifications(): Promise<void>;
/**
 * Delete all users notifications
 */
export declare function deleteAllNotifications(): Promise<void>;
/**
 * Mark all users notifications as seen
 */
export declare function markAllAsSeen(): Promise<void>;
/**
 * Mark notification as seen
 *
 * @param id Alert id
 * @param processId Process id
 */
export declare function markNotificationAsSeen(data: NotificationExtraPayload): Promise<HttpPayload<void>>;
/**
 * Mark notification as received
 *
 * @param id Alert id
 * @param processId Process id
 */
export declare function markNotificationAsReceived(data: NotificationExtraPayload): Promise<HttpPayload<void>>;
/**
 * After this BE will send notification to device
 * @param type
 * @param device
 */
export declare function sendTestNotification(
  type: NotificationExtraPayload['category'],
  registrationHash: string,
): void;
