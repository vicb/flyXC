import type { LatLon } from './optimizer';

/**
 * Linearly interpolates points between two coordinates (test utility only).
 *
 * @param start Start coordinate.
 * @param end End coordinate.
 * @param segments Number of segments to divide the leg into.
 * @returns Array of coordinates including start and end.
 */
export function interpolateSegment(start: LatLon, end: LatLon, segments: number): LatLon[] {
  const points: LatLon[] = [start];
  for (let i = 1; i < segments; i++) {
    points.push({
      lat: start.lat + ((end.lat - start.lat) * i) / segments,
      lon: start.lon + ((end.lon - start.lon) * i) / segments,
    });
  }
  points.push(end);
  return points;
}

/**
 * Creates a track with interpolated segments between sequential waypoints (test utility only).
 *
 * @param waypoints Ordered waypoints to connect.
 * @param segmentsPerLeg Number of segments per leg between waypoints.
 * @returns Array of track coordinates without duplicate intermediate vertices.
 */
export function createInterpolatedTrack(waypoints: LatLon[], segmentsPerLeg = 1): LatLon[] {
  if (waypoints.length <= 1) {
    return [...waypoints];
  }
  const track: LatLon[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = interpolateSegment(waypoints[i], waypoints[i + 1], segmentsPerLeg);
    track.push(...(i === 0 ? leg : leg.slice(1)));
  }
  return track;
}
