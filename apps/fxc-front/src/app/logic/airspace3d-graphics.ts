import Color from '@arcgis/core/Color';
import type Geometry from '@arcgis/core/geometry/Geometry';
import Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';
import type Layer from '@arcgis/core/layers/Layer';
import type ArcgisMap from '@arcgis/core/Map';
import FillSymbol3DLayer from '@arcgis/core/symbols/FillSymbol3DLayer';
import LineSymbol3D from '@arcgis/core/symbols/LineSymbol3D';
import LineSymbol3DLayer from '@arcgis/core/symbols/LineSymbol3DLayer';
import MeshSymbol3D from '@arcgis/core/symbols/MeshSymbol3D';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import {
  AirspaceColorCategory,
  type AirspaceTyped,
  ASP_CATEGORY_COLOR,
  clamp,
  getAirspaceColorCategory,
  type LatLon,
  MERGED_AIRSPACE_ID_MIN,
  pointInFlatPolygon,
} from '@flyxc/common';

import { createPopupContent } from '../components/3d/popup-content';
import type { AirspaceWorkerItem } from '../workers/airspace3d-processor';
import type { CachedMeshEntry } from './airspace3d-mesh-cache';

export type CachedAirspaceItem = AirspaceWorkerItem & Partial<CachedMeshEntry>;

/**
 * Removes an ArcGIS `layer` from `map` (if attached) and destroys it, returning `undefined`.
 */
export function destroyLayer(map: ArcgisMap | undefined, layer: Layer | undefined): undefined {
  if (layer) {
    map?.remove(layer);
    layer.destroy();
  }
  return undefined;
}

/**
 * Destroys ArcGIS geometries and graphic instances to release WebGL GPU buffers.
 */
export function destroyGraphics(graphics: Iterable<Graphic | undefined>): void {
  for (const g of graphics) {
    if (!g) {
      continue;
    }
    (g.geometry as any)?.destroy?.();
    (g as any).destroy?.();
  }
}

/**
 * Creates a fill `MeshSymbol3D` for an airspace color category at the given alpha (0..1).
 */
export function createAirspaceFillSymbol(category: AirspaceColorCategory, alpha: number): MeshSymbol3D {
  const hex = ASP_CATEGORY_COLOR[category] ?? ASP_CATEGORY_COLOR[AirspaceColorCategory.Other];
  const fill = new Color(hex);
  fill.a = alpha;
  return new MeshSymbol3D({
    symbolLayers: [
      new FillSymbol3DLayer({
        material: { color: fill.toRgba(), colorMixMode: 'replace' },
        castShadows: false,
      }),
    ],
  });
}

/**
 * Creates a 3D perimeter contour `LineSymbol3D` for an airspace color category.
 */
export function createAirspaceLineSymbol(category: AirspaceColorCategory, opacityPercent: number): LineSymbol3D {
  const hex = ASP_CATEGORY_COLOR[category] ?? ASP_CATEGORY_COLOR[AirspaceColorCategory.Other];
  const color = new Color(hex);
  color.a = clamp((opacityPercent / 100) * 0.9, 0.2, 0.9);
  return new LineSymbol3D({
    symbolLayers: [
      new LineSymbol3DLayer({
        material: { color: color.toRgba() },
        size: 1.5,
        cap: 'round',
        join: 'round',
      }),
    ],
  });
}

/**
 * Opens the ArcGIS SceneView airspace info popup at `latLon` (and optional `clickZ`).
 */
export async function openAirspacePopup(
  scene: ArcgisScene,
  latLon: LatLon,
  html: string,
  clickZ?: number,
): Promise<void> {
  await scene.openPopup({
    location: new Point({
      latitude: latLon.lat,
      longitude: latLon.lon,
      ...(clickZ != null ? { z: clickZ, hasZ: true } : {}),
    }),
    title: 'Airspaces',
    content: createPopupContent(html),
  });
}

/**
 * Finds the loaded 3D airspace volume matching a 2D vector-tile airspace at `latLon` for highlighting.
 * Unmerged and reserved 3D airspaces share the exact 2D `id` (`< MERGED_AIRSPACE_ID_MIN`) and match directly;
 * coplanar-merged 3D volumes (`id >= MERGED_AIRSPACE_ID_MIN`) fall back to vertical bounds, color category,
 * and 2D polygon containment.
 */
export function findMatching3dItem(
  items: readonly CachedAirspaceItem[],
  target: AirspaceTyped,
  latLon: LatLon,
): CachedAirspaceItem | undefined {
  const byId = items.find((item) => item.airspace.id === target.id);
  if (byId) {
    return byId;
  }

  const targetCategory = getAirspaceColorCategory(target);
  const pad = 0.005;
  for (const item of items) {
    const a = item.airspace;
    if (
      a.id < MERGED_AIRSPACE_ID_MIN ||
      a.floorM !== target.floorM ||
      a.topM !== target.topM ||
      a.floorRefGnd !== target.floorRefGnd ||
      a.topRefGnd !== target.topRefGnd ||
      item.category !== targetCategory
    ) {
      continue;
    }
    const ext = item.polygon.extent;
    if (
      ext &&
      (latLon.lon < ext.xmin - pad ||
        latLon.lon > ext.xmax + pad ||
        latLon.lat < ext.ymin - pad ||
        latLon.lat > ext.ymax + pad)
    ) {
      continue;
    }
    if (pointInFlatPolygon(latLon.lon, latLon.lat, item.polygon.coords, item.polygon.ends)) {
      return item;
    }
  }
  return undefined;
}

/**
 * Synchronizes a category's cached `Graphic` in `graphicMap` with its new `geometry` and `sig`,
 * destroying replaced geometries or queueing removed graphics into `toRemove` / newly created ones into `toAdd`.
 */
export function syncCategoryGraphic(
  graphicMap: Map<AirspaceColorCategory, Graphic>,
  category: AirspaceColorCategory,
  geometry: Geometry | null,
  sig: number,
  getSymbol: (category: AirspaceColorCategory) => MeshSymbol3D | LineSymbol3D,
  attributes: Record<string, unknown>,
  toAdd: Graphic[],
  toRemove: Graphic[],
): void {
  const prev = graphicMap.get(category);
  if (prev && geometry) {
    const oldGeom = prev.geometry;
    prev.geometry = geometry;
    prev.attributes.sig = sig;
    if (oldGeom && oldGeom !== geometry) {
      (oldGeom as any).destroy?.();
    }
  } else if (prev && !geometry) {
    toRemove.push(prev);
    graphicMap.delete(category);
  } else if (!prev && geometry) {
    const graphic = new Graphic({
      geometry,
      symbol: getSymbol(category),
      attributes: { ...attributes, category, sig },
    });
    graphicMap.set(category, graphic);
    toAdd.push(graphic);
  }
}
