import { LatLon, LatLonZ } from 'flyxc/common/src/runtime-track';
import { createEvents } from 'micro-typed-events';

import type Graphic from 'esri/Graphic';
import type SceneView from 'esri/views/SceneView';

// Zoom the map in the given direction (typically mouse wheel).
export const zoomMap = createEvents<number>();

// Center the map on the passed position.
export const centerMap = createEvents<LatLonZ>();

// Center and zoom the map.
export const centerZoomMap = createEvents<LatLonZ, number>();

// Emit the group id of the added tracks.
export const trackGroupsAdded = createEvents<number[]>();
// Emit the group id of the removed tracks.
export const trackGroupsRemoved = createEvents<number[]>();

// Request current map to update the location.
export const requestLocation = createEvents();

// Click on a graphic of a SceneView (3d).
export const clickSceneView = createEvents<Graphic, SceneView>();

// User location.
export const geoLocation = createEvents<LatLon>();
