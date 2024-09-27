/**
 * Keep this file in-sync with incomingMessages in the embed repo.
 */

import type { MetricItem } from '@windy/Metric.d';
import type { LatLon } from '../../types/interfaces';

/**
 * Types of valid messages sent to the embed config via window.postMessage.
 */
export type OutgoingMessageType = 'updateDetail' | 'updateValues';

/**
 * Payload of the updateDetail message.
 */
export interface UpdateDetailPayload {
  coordinates: LatLon;
  rainUnit: MetricItem;
  showDetail: boolean;
  showMarker: boolean;
  temperatureUnit: MetricItem;
  windUnit: MetricItem;
}

/**
 * Payload of the updateValues message.
 */
export interface UpdateValuesPayload {
  /**
   * Coordinates.
   */
  coordinates: LatLon;

  /**
   * Level.
   */
  level: string;

  /**
   * User-friendly text of the level value.
   */
  levelText: string;

  /**
   * Overlay identifier.
   */
  overlay: string;

  /**
   * Overlay name.
   */
  overlayName: string;

  /**
   * Product identifier.
   */
  product: string;

  /**
   * Product name.
   */
  productName: string;

  /**
   * Zoom level.
   */
  zoom: number;
}

/**
 * Valid message data sent to the embed config via window.postMessage.
 */
export type OutgoingMessageData =
  | { type: 'updateDetail'; payload: Partial<UpdateDetailPayload> }
  | { type: 'updateValues'; payload: UpdateValuesPayload };
