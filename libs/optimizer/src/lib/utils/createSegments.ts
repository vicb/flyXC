import { ScoringTrack } from '../optimizer';

export type LatLonAltTime = { alt: number; lat: number; lon: number; timeSec: number };

/**
 * Create segments between 2 points.
 * Added points are computed by a linear interpolation
 * @param from start point of the segment
 * @param to end point
 * @param nbSegments number of segments created. If nbSegments <= 1 the result contains one segment ('from' -> 'to')
 * @return a ScoringTrack of nbSegments
 */
export function createSegments(from: LatLonAltTime, to: LatLonAltTime, nbSegments: number): ScoringTrack {
  const result: ScoringTrack = { alt: [], lat: [], lon: [], minTimeSec: 0, timeSec: [] };

  appendToResult(from);

  if (nbSegments > 1) {
    appendIntermediatePoints();
  }
  appendToResult(to);
  return result;

  function appendToResult(p: LatLonAltTime) {
    result.lat.push(p.lat);
    result.lon.push(p.lon);
    result.alt.push(p.alt);
    result.timeSec.push(p.timeSec);
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
