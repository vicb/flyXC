import type { HttpPayload } from '@windy/http.d';
import type { LiveAlertEvent } from '@plugins/startup-live-alerts/startup-live-alerts.d';
import type { GeolocationInfo, HomeLocation } from '@windy/interfaces';
import type { ArticlePromoData, ArticleStartupData } from '@plugins/articles/articles';
export declare const openObsoleteApp: () => Promise<boolean>;
/**
 * Opens article with whatsNew
 *
 * @returns true if article whatsNew was opened
 */
export declare const openWhatsNewArticle: (
  articlePromise: Promise<HttpPayload<ArticleStartupData>>,
) => Promise<boolean>;
/**
 * Determines if article should be displayed or not
 */
export declare const openArticle: (articlePromise: Promise<HttpPayload<ArticleStartupData>>) => Promise<boolean>;
export declare const openPromo: (promoPromise: Promise<HttpPayload<ArticlePromoData>>) => Promise<boolean>;
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
