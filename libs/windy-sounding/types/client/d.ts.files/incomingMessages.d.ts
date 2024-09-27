/**
 * Keep this file in-sync with outgoingMessages in the embed repo.
 */

import type { MetricItem } from '@windy/Metric.d';
import type { Levels, Overlays, Products } from '@windy/rootScope.d';

/**
 * Values parsed from the query string.
 */
export interface QueryStringEmbedParams {
  /**
   * @deprecated Deleted from the embed config (2023-09-20).
   */
  calendar: string;
  detailLat: number;
  detailLon: number;
  embedMake: boolean;
  /**
   * @deprecated Not sent from the old embed config.
   */
  forecast?: string;
  /**
   * @deprecated Menu constantly shown in the old embed config.
   */
  hideMenu: boolean;
  hideMessage: boolean;
  /**
   * Used in `rootScope.ts`.
   */
  lang?: string;
  lat: number;
  /**
   * @deprecated Currently not sent from the embed config (2023-09-20).
   */
  level?: Levels;
  lon: number;
  /**
   * @deprecated Location constantly set to `coordinates` in the old embed config.
   */
  location: string;
  metricRain?: MetricItem;
  metricTemp?: MetricItem;
  metricWind?: MetricItem;
  /**
   * @deprecated Currently not sent from the embed config (2023-09-20).
   */
  overlay?: Overlays;
  pressure: boolean;
  /**
   * @deprecated Currently not sent from the embed config (2023-09-20).
   */
  product?: Products;
  showDetail: boolean;
  showMarker: boolean;
  /**
   * @deprecated Only used for query string of type=alert
   */
  timestamps?: string;
  type: 'map' | 'alert' | 'forecast';
  zoom: number;
}

/**
 * Values received from the embed config via window.onMessage.
 * Subset of {@link QueryStringEmbedParams} with support for default units.
 */
export interface UpdateEmbedPayload {
  detailLat: number;
  detailLon: number;
  hideMessage: boolean;
  metricRain: QueryStringEmbedParams['metricRain'] | 'default';
  metricTemp: QueryStringEmbedParams['metricTemp'] | 'default';
  metricWind: QueryStringEmbedParams['metricWind'] | 'default';
  pressure: boolean;
  showDetail: boolean;
  showMarker: boolean;
}

export interface UpdateEmbedMessageData {
  type: 'updateEmbed';
  payload: UpdateEmbedPayload;
}

/**
 * Message data that is possible to receive via `window.onMessage`.
 */
export type IncomingMessageData = UpdateEmbedMessageData | unknown;
