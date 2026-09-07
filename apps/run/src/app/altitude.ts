// Altitude functionality using ElevationService from @flyxc/common-node.

import { ElevationService, type TrackCoordinates } from '@flyxc/common-node';

// Run app uses 160MB in-memory tile cache at zoom 10.
const elevationService = new ElevationService({ cacheSizeMb: 160, zoom: 10 });

export function fetchGroundAltitude(track: TrackCoordinates) {
  return elevationService.fetchGroundAltitude(track);
}
