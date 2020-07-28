import { getRhumbLineBearing } from 'geolib';

// Only refreshes tracker after 3 minutes.
export const REFRESH_EVERY_MINUTES = 3;

// Fetch 24h of data from the trackers.
export const REFRESH_MAX_HOURS = 24;

// Do not fetch for more than 40 seconds.
export const REFRESH_TIMEOUT_SECONDS = 40;

// Break lines if gap is more than.
const TRACK_GAP_MINUTES = 60;

// Do not keep points that are less than apart.
const MIN_POINT_GAP_MINUTES = 2;

export interface Point {
  lat: number;
  lon: number;
  alt: number;
  // Timestamps in milliseconds.
  ts: number;
  name: string;
  emergency: boolean;
  msg?: string;
  // speed is supported by inreach only.
  speed?: number;
  // Whether the gps fix is valid - inreach only.
  valid?: boolean;
  // Is this the last fix for the tracker ?
  is_last_fix?: boolean;
  // Direction in degree from the last point (0 = north, clockwise).
  // Populated for the the last point only.
  bearing?: number;
}

export interface LineString {
  // Array of [lon, lat].
  line: number[][];
  // Timestamp of the oldest fix in milliseconds.
  first_ts: number;
}

// Creates GeoJson features for a list of points:
// - Order the points by ascending timestamps,
// - Remove points that are to close to each other,
// - Compute properties specific to the last point,
// - Create a line for each split.
export function createFeatures(points: Point[]): Array<Point | LineString> {
  if (points.length == 0) {
    return [];
  }
  // Sort points with older TS first.
  points.sort((a, b) => (a.ts > b.ts ? 1 : -1));
  // Remove points that are too close to each other.
  // Keep the first, last, and any protected point.
  let previousTs: number | undefined = points[0].ts;
  const simplifiedPoints: Point[] = [points[0]];
  for (let i = 1; i < points.length - 2; i++) {
    const point = points[i];
    if (isProtectedPoint(point) || point.ts - previousTs > MIN_POINT_GAP_MINUTES * 60 * 1000) {
      simplifiedPoints.push(point);
      previousTs = point.ts;
    }
  }
  simplifiedPoints.push(points[points.length - 1]);
  points = simplifiedPoints;
  // Add extra info to the very last point.
  const numPoints = points.length;
  points[numPoints - 1].is_last_fix = true;
  if (points.length >= 2) {
    points[numPoints - 1].bearing = Math.round(getRhumbLineBearing(points[numPoints - 2], points[numPoints - 1]));
  }
  // Group points by track (split if the gap is too large).
  const lines: LineString[] = [];
  previousTs = undefined;
  let currentLine: LineString | undefined;
  points.forEach((point) => {
    const ts = point.ts;
    // Create a new line at the beginning and at each gap.
    if (previousTs == null || ts - previousTs > TRACK_GAP_MINUTES * 60 * 1000) {
      if (currentLine != null) {
        lines.push(currentLine);
      }
      currentLine = { line: [], first_ts: ts };
    }
    // Accumulate fixes.
    currentLine?.line.push([point.lon, point.lat]);
    previousTs = ts;
  });
  if (currentLine) {
    lines.push(currentLine);
  }

  return [...points, ...lines];
}

// Returns whether a point should not be removed.
// Points with emergency or messages must not be removed.
function isProtectedPoint(point: Point): boolean {
  return point.emergency == true || (point.msg != null && point.msg.length > 0);
}
