import { createEvents } from 'micro-typed-events';

import { LatLon } from '../../../../common/track';

// Zoom the map in the given direction (typically mouse wheel).
export const zoomMap = createEvents<number>();

// Center the map on the passed position.
export const centerMap = createEvents<LatLon>();

// Center and zoon the map.
export const centerZoomMap = createEvents<LatLon, number>();

// Ids of tracks added or removed.
export const tracksAdded = createEvents<number[]>();
export const tracksRemoved = createEvents<number[]>();

// Request current map to update the location.
export const requestLocation = createEvents();

// User location.
export const geoLocation = createEvents<LatLon>();
