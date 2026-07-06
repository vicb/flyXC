import type { SubscriptionInfo } from '@plugins/shared/subscription-services/subscription-services.d';
export type SubscriptionIssue = {
    type: 'graced' | 'paused' | 'onhold';
} | {
    type: 'expiring';
    expiresInHours: number;
};
/**
 * Clear pending subscription (i.e. unclaimed, not-redeemed subscription) from store.
 */
export declare const clearPendingSubscription: () => void;
/**
 * Set pending subscription to store.
 *
 * @param {string} redeemCode Code to store
 */
export declare const setPendingSubscription: (redeemCode: string) => void;
export declare const setSubsBodyClass: (tier: 'premium') => void;
/**
 * Set a tier for the user. It also clears pending and failed subscriptions if tier is passed.
 */
export declare const setTier: (subscriptionInfo: SubscriptionInfo | null) => void;
/**
 * Returns boolean value if user has any valid premium subscription.
 *
 * @returns True if user has a valid premium subscription, false otherwise
 */
export declare const hasAny: () => boolean;
/**
 * Returns null if everything is ok, object with issue otherwise.
 */
export declare const getIssue: () => SubscriptionIssue | null;
/**
 * Check if any pending subscription (i.e. unclaimed, not-redeemed subscription) is stored.
 * Open `pending-subscription` plugin if yes, void otherwise
 */
export declare const checkPendingSubscription: () => void;
/**
 * Returns short text for buttons which inform user about any subscription issue.
 * It is used only as a gateway to solving the whole issue. It must be short and clear.
 */
export declare const getBaitTitle: (issue: SubscriptionIssue | null) => string;
export declare const checkAndRenderSubsIssue: () => void;
