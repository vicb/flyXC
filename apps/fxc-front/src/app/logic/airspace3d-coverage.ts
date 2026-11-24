import type Extent from '@arcgis/core/geometry/Extent';
import Point from '@arcgis/core/geometry/Point';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';
import type SceneView from '@arcgis/core/views/SceneView';
import {
  AIRSPACE_3D_TILE_ZOOM,
  AIRSPACE_TILE_SIZE,
  type Bounds2D,
  clamp,
  getPixelCoordinates,
  lonLatToWebMercator,
} from '@flyxc/common';

import type { TileCoord } from '../workers/airspace3d-processor';
import type { GroundSampler } from './airspace3d-mesh';

export const MIN_3D_ZOOM = 10;
export const MAX_TILES_3D = 36;

export interface VisibleTileCoverage {
  tiles: TileCoord[];
  bounds: Bounds2D | null;
}

/**
 * Returns whether an ArcGIS elevation sample is a finite terrain height in meters.
 */
export function isValidElevation(z: unknown, noData?: number | null): z is number {
  return typeof z === 'number' && Number.isFinite(z) && z !== noData && z <= 20000;
}

/**
 * Creates a fast synchronous ground elevation sampler returning exaggerated elevation in meters.
 */
export function createGroundSampler(sampler?: ElevationSampler): GroundSampler {
  if (!sampler) {
    return () => 0;
  }
  const noData = sampler.noDataValue;
  const sr = sampler.spatialReference;
  const isWGS84 = Boolean(sr?.isWGS84);
  const isWebMercator = Boolean(sr?.isWebMercator);
  let queryPoint: Point | undefined;

  return (lon: number, lat: number): number => {
    let z: number | null | undefined;
    if (isWGS84) {
      z = sampler.elevationAt(lon, lat);
    } else if (isWebMercator) {
      const [x, y] = lonLatToWebMercator(lon, lat);
      z = sampler.elevationAt(x, y);
    } else {
      queryPoint ??= new Point({ longitude: lon, latitude: lat });
      queryPoint.longitude = lon;
      queryPoint.latitude = lat;
      z = sampler.queryElevation(queryPoint)?.z;
    }

    return isValidElevation(z, noData) ? z : 0;
  };
}

function toGeoExtent(extent?: Extent | null): Extent | undefined {
  if (!extent) {
    return undefined;
  }
  if (extent.spatialReference?.isWGS84) {
    return extent;
  }
  if (extent.spatialReference?.isWebMercator) {
    return (webMercatorUtils.webMercatorToGeographic(extent) as Extent) ?? undefined;
  }
  return undefined;
}

/**
 * Computes visible airspace tile coordinates and padded geographic bounds covering the 3D frustum,
 * stepping tile zoom down as needed so border tiles fit within {@link MAX_TILES_3D}.
 */
export function getVisibleTileCoverage(view: SceneView): VisibleTileCoverage {
  const zoom = view.zoom;
  const center = view.center;
  const geoExtent = toGeoExtent(view.extent) ?? toGeoExtent(view.visibleArea?.extent);
  if (!Number.isFinite(zoom) || zoom < MIN_3D_ZOOM || !center || !geoExtent) {
    return { tiles: [], bounds: null };
  }

  let xmin = geoExtent.xmin;
  let xmax = geoExtent.xmax;
  let ymin = geoExtent.ymin;
  let ymax = geoExtent.ymax;

  const centerLon = center.longitude ?? (xmin + xmax) / 2;
  const centerLat = center.latitude ?? (ymin + ymax) / 2;
  // Clamp horizon radius to ~175 km (1.9° lon, 1.5° lat at 45°N) for wide regional coverage.
  const maxHalfLon = clamp((xmax - xmin) * 1.5, 0.4, 1.9);
  const maxHalfLat = clamp((ymax - ymin) * 1.5, 0.3, 1.5);

  // Expand extent with SceneView.visibleArea so tilted frustum side/bottom/far borders are covered.
  const visibleGeoExtent = toGeoExtent(view.visibleArea?.extent);
  if (visibleGeoExtent) {
    xmin = Math.min(xmin, clamp(visibleGeoExtent.xmin, centerLon - maxHalfLon, centerLon + maxHalfLon));
    xmax = Math.max(xmax, clamp(visibleGeoExtent.xmax, centerLon - maxHalfLon, centerLon + maxHalfLon));
    ymin = Math.min(ymin, clamp(visibleGeoExtent.ymin, centerLat - maxHalfLat, centerLat + maxHalfLat));
    ymax = Math.max(ymax, clamp(visibleGeoExtent.ymax, centerLat - maxHalfLat, centerLat + maxHalfLat));
  }

  // Pad slightly to reduce pop-in during short pans.
  const padLon = (xmax - xmin) * 0.08;
  const padLat = (ymax - ymin) * 0.08;
  const paddedMinLon = clamp(xmin - padLon, -179.99, 179.99);
  const paddedMaxLon = clamp(xmax + padLon, -179.99, 179.99);
  const paddedMinLat = clamp(ymin - padLat, -85, 85);
  const paddedMaxLat = clamp(ymax + padLat, -85, 85);

  const maxIndex = (1 << AIRSPACE_3D_TILE_ZOOM) - 1;
  const nw = getPixelCoordinates(
    { lat: paddedMaxLat, lon: paddedMinLon },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;
  const se = getPixelCoordinates(
    { lat: paddedMinLat, lon: paddedMaxLon },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;
  const minX = clamp(Math.min(nw.x, se.x), 0, maxIndex);
  const maxX = clamp(Math.max(nw.x, se.x), 0, maxIndex);
  const minY = clamp(Math.min(nw.y, se.y), 0, maxIndex);
  const maxY = clamp(Math.max(nw.y, se.y), 0, maxIndex);

  const centerTile = getPixelCoordinates(
    { lat: clamp(centerLat, -85, 85), lon: clamp(centerLon, -179.99, 179.99) },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;

  const coords: Array<TileCoord & { dist2: number }> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const dx = x - centerTile.x;
      const dy = y - centerTile.y;
      coords.push({ x, y, z: AIRSPACE_3D_TILE_ZOOM, dist2: dx * dx + dy * dy });
    }
  }

  coords.sort((a, b) => a.dist2 - b.dist2);
  return {
    tiles: coords.slice(0, MAX_TILES_3D).map(({ x, y, z }) => ({ x, y, z })),
    bounds: {
      xmin: paddedMinLon,
      ymin: paddedMinLat,
      xmax: paddedMaxLon,
      ymax: paddedMaxLat,
    },
  };
}
