import type Graphic from '@arcgis/core/Graphic';
import type SceneView from '@arcgis/core/views/SceneView';
import type { LatLon, LatLonAlt } from '@flyxc/common';
import { createEvents } from 'micro-typed-events';

// Zoom the map in the given direction (typically mouse wheel).
export const zoomMap = createEvents<number>();

// Center the map on the passed position.
export const centerMap = createEvents<LatLonAlt>();

// Center and zoom the map.
export const centerZoomMap = createEvents<LatLonAlt, number>();

// Emit the group id of the added tracks.
export const trackGroupsAdded = createEvents<number[]>();
// Emit the group id of the removed tracks.
export const trackGroupsRemoved = createEvents<number[]>();

// Click on a graphic of a SceneView (3d).
export const clickSceneView = createEvents<Graphic, SceneView>();

// User location.
// The second parameter is whether the location is user initiated.
export const geoLocation = createEvents<LatLon, boolean>();

// Start drawing a route on the maps.
export const drawRoute = createEvents<void>();
