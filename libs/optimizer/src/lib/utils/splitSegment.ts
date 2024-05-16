import { LatLonAlt } from '@flyxc/common';
import { ScoringTrack } from '../optimizer';

export type LatLonAltTime = LatLonAlt & { timeSec: number };

/**
 * Split a segment into a given number of intervals.
 * Added points are computed by a linear interpolation
 * @param from start point of the segment
 * @param to end point
 * @param nbIntervals number of intervals in the results. If nbIntervals <= 1
 */
export function splitSegment(
  from: LatLonAltTime,
  to: LatLonAltTime,
  nbIntervals: number,
): ScoringTrack {
  const result: ScoringTrack = { alt: [], lat: [], lon: [], minTimeSec: 0, timeSec: [] };

  appendToResult(from);

  if (nbIntervals > 1){
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
    const deltaLat = (to.lat - from.lat) / nbIntervals;
    const deltaLon = (to.lon - from.lon) / nbIntervals;
    const deltaAlt = (to.alt - from.alt) / nbIntervals;
    const deltaTimeSec = (to.timeSec - from.timeSec) / nbIntervals;
    for (let index = 1; index < nbIntervals; index++) {
      appendToResult({
        lat: from.lat + deltaLat * index,
        lon: from.lon + deltaLon * index,
        alt: from.alt + deltaAlt * index,
        timeSec: from.timeSec + deltaTimeSec * index,
      });
    }
  }
}
