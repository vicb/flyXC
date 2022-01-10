// Fetches the elevation for the last fix of the updates.
//
// We mostly care about the AGL of the last fix.

import { FetcherState } from 'flyxc/common/protos/fetcher-state';
import { LiveTrack } from 'flyxc/common/protos/live-track';
import { LatLon } from 'flyxc/common/src/runtime-track';
import { getTextRetry } from 'flyxc/common/src/superagent';
import { formatReqError } from 'flyxc/common/src/util';

import { getElevationUrl, parseElevationResponse } from './arcgis';

export interface ElevationUpdates {
  errors: string[];
  // Number of points fetched.
  numFetched: number;
  // Number of elevation retrieved.
  numRetrieved: number;
}

// Add the last fix altitude where it is missing.
//
// Note:
// - some trackers add the AGL,
// - or the AGL might already have been populated.
export async function patchLastFixAGL(state: FetcherState): Promise<ElevationUpdates> {
  const points: LatLon[] = [];
  let tracks: LiveTrack[] = [];
  const updates: ElevationUpdates = {
    errors: [],
    numFetched: 0,
    numRetrieved: 0,
  };

  for (const pilot of Object.values(state.pilots)) {
    const track = pilot.track;
    if (!track) {
      continue;
    }
    if (track.lat.length > 0) {
      const index = track.lat.length - 1;
      if (track.extra[index]?.gndAlt == null) {
        tracks.push(track);
        points.push({ lat: track.lat[index], lon: track.lon[index] });
      }
    }
  }

  if (points.length == 0) {
    return updates;
  }

  updates.numFetched = points.length;

  try {
    const url = getElevationUrl(points);
    const response = await getTextRetry(url, { timeoutSec: 8 });
    if (response.ok) {
      const elevations = parseElevationResponse(JSON.parse(response.body), points);
      updates.numRetrieved = elevations.length;
      let elevationIndex = 0;
      tracks = tracks.slice(0, elevations.length);
      for (const track of tracks) {
        const index = track.lat.length - 1;
        track.extra[index] ??= {};
        track.extra[index].gndAlt = Math.round(elevations[elevationIndex]);
        elevationIndex++;
      }
    } else {
      throw new Error(`HTTP Status = ${response.status} for ${url}`);
    }
  } catch (e) {
    updates.errors.push(formatReqError(e));
  }

  return updates;
}
