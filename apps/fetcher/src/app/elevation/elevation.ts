// Fetches the elevation for the last fix of the updates.
//
// We mostly care about the AGL of the last fix.

import type { LatLon, protos } from '@flyxc/common';
import { fetchResponse, formatReqError } from '@flyxc/common';

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
export async function patchLastFixAGL(state: protos.FetcherState): Promise<ElevationUpdates> {
  const points: LatLon[] = [];
  let tracks: protos.LiveTrack[] = [];
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
    const response = await fetchResponse(url, { timeoutS: 10 });
    if (response.ok) {
      const elevations = parseElevationResponse(await response.json(), points);
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
