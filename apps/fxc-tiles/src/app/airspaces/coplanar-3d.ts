import { type AirspaceFeature, MERGED_AIRSPACE_ID_MIN, RESERVED_AIRSPACE_ID_MAX } from '@flyxc/common';
import Clipper2Z from 'clipper2-wasm';
import Flatbush from 'flatbush';

export type { AirspaceFeature } from '@flyxc/common';

let clipperInstance: any = null;

export async function getClipper() {
  if (!clipperInstance) {
    clipperInstance = await Clipper2Z();
  }
  return clipperInstance;
}

/**
 * Computes the 2D bounding box [minX, minY, maxX, maxY] for GeoJSON Polygon or MultiPolygon coordinates.
 * Operates with direct loops for minimal GC allocations.
 */
export function computeBBox(coords: any): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (!Array.isArray(coords) || coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  // Support both Polygon (number[][][]) and MultiPolygon (number[][][][]) coordinates
  const isMulti = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0]);
  const polygons = isMulti ? coords : [coords];

  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p];
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r];
      for (let i = 0; i < ring.length; i++) {
        const pt = ring[i];
        const x = pt[0];
        const y = pt[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Converts a Clipper2 PathD into an array of [lon, lat] coordinates.
 * Simplifies collinear vertices at 6 decimal places (~0.1m precision) and guarantees closed rings.
 */
function pathToCoords(c: any, path: any): [number, number][] {
  const cleanPath = c.TrimCollinearD(path, 6, false);
  const v = cleanPath.view();
  const coords: [number, number][] = [];
  for (let j = 0; j < v.length; j += 3) {
    coords.push([v[j], v[j + 1]]);
  }
  cleanPath.delete();
  if (coords.length > 0) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }
  }
  return coords;
}

/**
 * Minimum area in deg^2 (~80,000 m^2) for a polygon ring.
 * Eliminates micro-slivers and artifact holes generated during 2D boolean union of coplanar airspaces.
 */
export const MIN_RING_AREA_DEG2 = 1e-5;

export function computeRingAreaDeg2(coords: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += (coords[i + 1][0] - coords[i][0]) * (coords[i + 1][1] + coords[i][1]);
  }
  return Math.abs(area) * 0.5;
}

/**
 * Recursively extracts exterior and interior rings from Clipper2 PolyPathD tree.
 *
 * Micro-islands and micro-holes below MIN_RING_AREA_DEG2 are filtered out directly in WASM (AreaPathD)
 * before extracting coordinates into JavaScript arrays, saving CPU time and GC allocations while
 * preventing vertical picket-fence / zebra-stripe artifacts in 3D rendering.
 */
function extractPolygonsFromPolyTree(c: any, node: any, isRoot = false): [number, number][][][] {
  const result: [number, number][][][] = [];

  if (isRoot) {
    for (let i = 0; i < node.count(); i++) {
      result.push(...extractPolygonsFromPolyTree(c, node.child(i), false));
    }
    return result;
  }

  const poly = node.polygon();
  // Fast WASM area check: drop micro-islands before allocating JS coordinate arrays
  if (Math.abs(c.AreaPathD(poly)) < MIN_RING_AREA_DEG2) {
    return result;
  }

  const outerCoords = pathToCoords(c, poly);
  if (outerCoords.length >= 4) {
    const rings: [number, number][][] = [outerCoords];
    for (let j = 0; j < node.count(); j++) {
      const holeNode = node.child(j);
      const holePoly = holeNode.polygon();
      // Drop micro-holes directly in WASM (heals tiny artifact gaps along shared seams)
      if (Math.abs(c.AreaPathD(holePoly)) >= MIN_RING_AREA_DEG2) {
        const holeCoords = pathToCoords(c, holePoly);
        if (holeCoords.length >= 4) {
          rings.push(holeCoords);
        }
      }
      for (let k = 0; k < holeNode.count(); k++) {
        result.push(...extractPolygonsFromPolyTree(c, holeNode.child(k), false));
      }
    }
    result.push(rings);
  }

  return result;
}

function copyCleanProperties(p: AirspaceFeature['properties']): Record<string, any> {
  const props: Record<string, any> = {
    icaoClass: p.icaoClass,
    type: p.type,
    activity: p.activity ?? 0,
    floorM: p.floorM,
    floorRefGnd: Boolean(p.floorRefGnd),
    topM: p.topM,
    topRefGnd: Boolean(p.topRefGnd),
    flags: p.flags ?? 0,
  };
  return props;
}

/**
 * Dissolves overlapping coplanar airspaces into unified 3D volume footprints.
 *
 * Airspaces sharing the exact same 3D vertical bracket and category
 * (icaoClass, type, floorM, topM, floorRefGnd, topRefGnd) that physically overlap
 * are merged using Clipper2 (WASM) 2D boolean polygon union.
 *
 * Every resulting feature is guaranteed a unique integer `id` at the top level
 * (and no `id` in properties).
 */
export async function mergeCoplanarAirspaces(
  features: AirspaceFeature[],
  startingId = MERGED_AIRSPACE_ID_MIN,
): Promise<AirspaceFeature[]> {
  const c = await getClipper();
  let nextId = startingId;
  const resultFeatures: AirspaceFeature[] = [];

  // Exclude airspaces with reserved IDs (id <= RESERVED_AIRSPACE_ID_MAX) from coplanar merging.
  // Their IDs and boundaries are preserved untouched so seasonal and override rules match exactly.
  const mergeCandidates: AirspaceFeature[] = [];
  for (const f of features) {
    const fid = Number(f.id);
    if (fid > 0 && fid <= RESERVED_AIRSPACE_ID_MAX) {
      resultFeatures.push({
        type: 'Feature',
        id: fid,
        properties: copyCleanProperties(f.properties) as any,
        geometry: f.geometry,
      });
    } else {
      mergeCandidates.push(f);
    }
  }

  // 1. Group features by vertical coplanar bracket
  const brackets = new Map<string, AirspaceFeature[]>();
  for (const f of mergeCandidates) {
    const p = f.properties;
    const key = `${p.icaoClass}|${p.type}|${p.floorM}|${p.topM}|${p.floorRefGnd ? 1 : 0}|${p.topRefGnd ? 1 : 0}`;
    let list = brackets.get(key);
    if (!list) {
      list = [];
      brackets.set(key, list);
    }
    list.push(f);
  }

  // 2. Process each coplanar bracket
  for (const items of brackets.values()) {
    if (items.length === 1) {
      const f = items[0];
      resultFeatures.push({
        type: 'Feature',
        id: Number(f.id),
        properties: copyCleanProperties(f.properties) as any,
        geometry: f.geometry,
      });
      continue;
    }

    // Spatial index to identify candidates with overlapping bounding boxes
    const index = new Flatbush(items.length);
    const bboxes = items.map((item) => computeBBox(item.geometry.coordinates));
    for (const b of bboxes) {
      index.add(b.minX, b.minY, b.maxX, b.maxY);
    }
    index.finish();

    const candidateIndices = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      const b = bboxes[i];
      const overlaps = index.search(b.minX, b.minY, b.maxX, b.maxY);
      if (overlaps.length > 1) {
        candidateIndices.add(i);
      } else {
        // Isolated feature with zero bounding-box overlaps: preserve its original 2D id
        const f = items[i];
        resultFeatures.push({
          type: 'Feature',
          id: Number(f.id),
          properties: copyCleanProperties(f.properties) as any,
          geometry: f.geometry,
        });
      }
    }

    if (candidateIndices.size === 0) {
      continue;
    }

    const candidateItems: AirspaceFeature[] = [];
    const candidateTree = new Flatbush(candidateIndices.size);
    for (const idx of candidateIndices) {
      candidateItems.push(items[idx]);
      const b = bboxes[idx];
      candidateTree.add(b.minX, b.minY, b.maxX, b.maxY);
    }
    candidateTree.finish();

    const clipper = new c.ClipperD(6);
    const paths = new c.PathsD();

    try {
      for (const f of candidateItems) {
        const coords =
          f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : (f.geometry.coordinates as [number, number][][][]);

        for (const poly of coords) {
          for (const ring of poly) {
            if (ring.length >= 3) {
              // Direct typed array allocation avoids V8 dynamic array resizing overhead
              const flat = new Float64Array(ring.length * 2);
              let idx = 0;
              for (let r = 0; r < ring.length; r++) {
                flat[idx++] = ring[r][0];
                flat[idx++] = ring[r][1];
              }
              const path = c.MakePathD(flat);
              paths.push_back(path);
              path.delete();
            }
          }
        }
      }

      clipper.AddSubject(paths);
      const polyTree = new c.PolyPathD();
      clipper.ExecutePoly(c.ClipType.Union, c.FillRule.NonZero, polyTree);

      const mergedPolygons = extractPolygonsFromPolyTree(c, polyTree, true);
      const emittedIds = new Set<number>();

      for (const polyCoords of mergedPolygons) {
        const polyBBox = computeBBox(polyCoords);
        const matches = candidateTree.search(polyBBox.minX, polyBBox.minY, polyBBox.maxX, polyBBox.maxY);
        const baseProps = matches.length > 0 ? candidateItems[matches[0]].properties : candidateItems[0].properties;
        let flags = 0;
        for (const idx of matches) {
          flags |= candidateItems[idx].properties.flags ?? 0;
        }

        let id: number;
        const origId = matches.length === 1 ? Number(candidateItems[matches[0]].id) : -1;
        if (origId > 0 && !emittedIds.has(origId)) {
          emittedIds.add(origId);
          id = origId;
        } else {
          id = nextId++;
        }

        resultFeatures.push({
          type: 'Feature',
          id,
          properties: {
            icaoClass: baseProps.icaoClass,
            type: baseProps.type,
            activity: baseProps.activity ?? 0,
            floorM: baseProps.floorM,
            floorRefGnd: Boolean(baseProps.floorRefGnd),
            topM: baseProps.topM,
            topRefGnd: Boolean(baseProps.topRefGnd),
            flags,
          },
          geometry: {
            type: 'Polygon',
            coordinates: polyCoords,
          },
        });
      }

      polyTree.delete();
    } catch {
      // Fallback: emit candidate features individually with their original 2D IDs
      for (const f of candidateItems) {
        resultFeatures.push({
          type: 'Feature',
          id: Number(f.id),
          properties: copyCleanProperties(f.properties) as any,
          geometry: f.geometry,
        });
      }
    } finally {
      paths.delete();
      clipper.delete();
    }
  }

  return resultFeatures;
}
