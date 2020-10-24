import { LatLon } from 'flyxc/common/src/track';
import { createEvents } from 'micro-typed-events';

// Zoom the map in the given direction (typically mouse wheel).
export const zoomMap = createEvents<number>();

// Center the map on the passed position.
export const centerMap = createEvents<LatLon>();

// Center and zoon the map.
export const centerZoomMap = createEvents<LatLon, number>();

// Emit the group id of the added tracks.
export const trackGroupsAdded = createEvents<number[]>();
// Emit the group id of the removed tracks.
export const trackGroupsRemoved = createEvents<number[]>();

// Request current map to update the location.
export const requestLocation = createEvents();

// User location.
export const geoLocation = createEvents<LatLon>();
