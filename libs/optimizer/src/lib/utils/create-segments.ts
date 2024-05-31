import { LatLonAltTime, ScoringTrack } from '../optimizer';

/**
 * Creates a track with segments.
 *
 * Points are computed by a linear interpolation
 *
 * @return a ScoringTrack of nbSegments
 */
export function createSegments(startPoint: LatLonAltTime, endPoint: LatLonAltTime, nbSegments: number): ScoringTrack {
  const points: LatLonAltTime[] = [];

  points.push(startPoint);

  const deltaLat = (endPoint.lat - startPoint.lat) / nbSegments;
  const deltaLon = (endPoint.lon - startPoint.lon) / nbSegments;
  const deltaAlt = (endPoint.alt - startPoint.alt) / nbSegments;
  const deltaTimeSec = (endPoint.timeSec - startPoint.timeSec) / nbSegments;
  for (let index = 1; index < nbSegments; index++) {
    points.push({
      lat: startPoint.lat + deltaLat * index,
      lon: startPoint.lon + deltaLon * index,
      alt: Math.round(startPoint.alt + deltaAlt * index),
      timeSec: Math.round(startPoint.timeSec + deltaTimeSec * index),
    });
  }

  points.push(endPoint);

  return { points };
}
