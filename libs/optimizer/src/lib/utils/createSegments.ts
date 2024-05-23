import { LatLonAltTime, ScoringTrack } from '../optimizer';


/**
 * Create segments between 2 points.
 * Added points are computed by a linear interpolation
 * @param from start point of the segment
 * @param to end point
 * @param minTimeSec time in seconds since 1970-01-01T00:00:00.000 when the track starts
 * @param nbSegments number of segments created. If nbSegments <= 1 the result contains one segment ('from' -> 'to')
 * @return a ScoringTrack of nbSegments
 */
export function createSegments(from: LatLonAltTime, to: LatLonAltTime, minTimeSec: number, nbSegments: number): ScoringTrack {
  const result: ScoringTrack = { points: [], minTimeSec };

  appendToResult(from);

  if (nbSegments > 1) {
    appendIntermediatePoints();
  }
  appendToResult(to);
  return result;

  function appendToResult(p: LatLonAltTime) {
    result.points.push(p);
  }

  function appendIntermediatePoints() {
    const deltaLat = (to.lat - from.lat) / nbSegments;
    const deltaLon = (to.lon - from.lon) / nbSegments;
    const deltaAlt = (to.alt - from.alt) / nbSegments;
    const deltaTimeSec = (to.timeSec - from.timeSec) / nbSegments;
    for (let index = 1; index < nbSegments; index++) {
      appendToResult({
        lat: from.lat + deltaLat * index,
        lon: from.lon + deltaLon * index,
        alt: from.alt + deltaAlt * index,
        timeSec: from.timeSec + deltaTimeSec * index,
      });
    }
  }
}
