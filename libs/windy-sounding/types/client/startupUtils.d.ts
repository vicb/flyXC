import type { HttpPayload } from '@windy/http.d';
import type { WhatsNewObsolete, WhatsNewData } from '@windy/startup.d';
import type { LiveAlertEvent } from '@plugins/startup-live-alerts/startup-live-alerts.d';
import type { GeolocationInfo, HomeLocation } from '@windy/interfaces';
/**
 * Opens whatsNew plugin, displays app is obsolete message or does nothing
 *
 * @returns true if whatsNew or app is obsolete was opened
 */
export declare const openWhatsNewOrObsoleteApp: (
  whatsNewPromise: Promise<HttpPayload<WhatsNewData | WhatsNewObsolete>>,
) => Promise<boolean>;
/**
 * Determines if article should be displayed or not
 */
export declare const loadAndOpenArticle: (coords: HomeLocation | GeolocationInfo) => Promise<boolean>;
export declare const openLiveAlert: (
  coords: HomeLocation | GeolocationInfo,
  liveAlertsPromise: Promise<
    HttpPayload<{
      alerts: LiveAlertEvent[];
    }>
  >,
) => Promise<boolean>;
export declare const openPin2Hp: () => Promise<void>;
export declare const loadPatch: () => Promise<void>;
