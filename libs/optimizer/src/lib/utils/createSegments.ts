import { LatLonAltTime, ScoringTrack } from '../optimizer';

/**
 * Create segments between 2 points.
 * Added points are computed by a linear interpolation
 * @param from start point of the segment
 * @param to end point
 * @param minTimeSec time in seconds since 1970-01-01T00:00:00.000 when the track starts
 * @param nbSegments number of segments created. If nbSegments <= 1 the result contains one segment ('from' -> 'to')
 * @param distributionFactor if nbSegments > 1, this factor will narrow the distance between generated points and the start
 *                           point of the segment. if close to zero, points will be close to the start point.
 *                           if equals 1, points will be equally distributed along the segment.
 * @return a ScoringTrack of nbSegments
 */
export function createSegments(
  from: LatLonAltTime,
  to: LatLonAltTime,
  minTimeSec: number,
  nbSegments: number,
  distributionFactor = 1,
): ScoringTrack {
  const result: ScoringTrack = { points: [], startTimeSec: minTimeSec };

  result.points.push(from);

  if (nbSegments > 1) {
    appendIntermediatePoints();
  }
  result.points.push(to);
  return result;

  function appendIntermediatePoints() {
    const deltaLat = ((to.lat - from.lat) * distributionFactor) / nbSegments;
    const deltaLon = ((to.lon - from.lon) * distributionFactor) / nbSegments;
    const deltaAlt = ((to.alt - from.alt) * distributionFactor) / nbSegments;
    const deltaTimeSec = ((to.timeSec - from.timeSec) * distributionFactor) / nbSegments;
    for (let index = 1; index < nbSegments; index++) {
      result.points.push({
        lat: from.lat + deltaLat * index,
        lon: from.lon + deltaLon * index,
        alt: Math.round(from.alt + deltaAlt * index),
        timeSec: from.timeSec + deltaTimeSec * index,
      });
    }
  }
}
