import type { protos } from '@flyxc/common';

/**
 * Metrics that can be displayed on the chart's primary Y-axis.
 */
export const ChartYAxis = {
  /** Altitude profile (in meters, formatted according to user preferences). */
  Altitude: 0,
  /** Horizontal ground speed profile. */
  Speed: 1,
  /** Vertical speed (variometer) profile. */
  Vario: 2,
} as const;

export type ChartYAxis = (typeof ChartYAxis)[keyof typeof ChartYAxis];

/**
 * Generic track representation rendered by `<chart-element>`.
 *
 * Can represent runtime tracks (e.g. from IGC/GPX files) or live tracking tracks.
 */
export interface ChartTrack {
  /** Unique identifier of the track. */
  id: string;
  /** Display name of the pilot or track. */
  name?: string;
  /** Visual color used to render the track line. */
  color?: string;
  /** Array of timestamps in epoch seconds. */
  timeSec: number[];
  /** Array of altitude points in meters corresponding to timeSec. */
  alt: number[];
  /** Optional array of ground elevation points in meters. */
  gndAlt?: number[];
  /** Optional array of horizontal speeds. */
  vx?: number[];
  /** Optional array of vertical speeds / variometer values. */
  vz?: number[];
  /** Optional airspace definitions intersected by the track. */
  airspaces?: protos.Airspaces;
  /** Time offset in seconds applied when synchronizing multiple tracks. */
  offsetSeconds?: number;
  /** Minimum altitude across the track. */
  minAlt?: number;
  /** Maximum altitude across the track. */
  maxAlt?: number;
  /** Minimum horizontal speed across the track. */
  minVx?: number;
  /** Maximum horizontal speed across the track. */
  maxVx?: number;
  /** Minimum vertical speed across the track. */
  minVz?: number;
  /** Maximum vertical speed across the track. */
  maxVz?: number;
  /** Start timestamp in epoch seconds. */
  minTimeSec?: number;
  /** End timestamp in epoch seconds. */
  maxTimeSec?: number;
  /** Whether the track is a live tracking track. */
  isLive?: boolean;
}
