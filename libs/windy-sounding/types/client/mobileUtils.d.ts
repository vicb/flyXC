/**
 * Reloads application
 *
 * @param url FQDN
 * @param disableForcedReloading Disable reloads, if location is the same
 */
export declare const reloadAppWithURL: (url: string, disableForcedReloading?: boolean) => void;
export declare const isFrequentUser: () => {
  sessionsPerDay: number;
  daysWithUs: number;
};
export declare const isAppReviewNecessaryConditionFulfilled: (daysWithUs: number) => boolean;
/**
 * Handles the Android back button press event.
 */
export declare const onAndroidBackButton: () => void;
export declare const handleAppsFlyer: () => Promise<void>;
