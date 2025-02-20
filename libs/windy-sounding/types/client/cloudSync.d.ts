import '@windy/colors';
import '@windy/metrics';
/**
 * Store all user settings into cloud.
 *
 * @returns True if sending data to cloud passed, false otherwise.
 */
export declare function storeSettings(): Promise<boolean>;
/**
 * Loads settings from a cloud and merge them
 *
 * @returns true if there were any data to merge
 */
export declare function loadAndMergeSettingFromCloud(): Promise<boolean>;
