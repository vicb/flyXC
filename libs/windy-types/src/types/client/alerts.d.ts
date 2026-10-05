import type { AlertRequest, AlertResponse, ForecastAlertResponse, LiveAlertResponse, StoredAlert } from './d.ts.files/alerts.d';
export type * from '@windy/alerts.d';
export declare function isForecastAlert(alert: AlertRequest): alert is ForecastAlertResponse;
export declare function isLiveAlert(alert: AlertRequest): alert is LiveAlertResponse;
/**
 * Default legacy IDB records (cached before the `type` discriminator
 * existed) to `'forecast'`.
 */
export declare function normalizeAlertType(alert: StoredAlert): AlertResponse;
