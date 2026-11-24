import { type AirspaceTyped, RESERVED_AIRSPACE_ID_MAX, setBoundedCache } from '@flyxc/common';

import type { AirspaceMeshData } from './airspace3d-mesh';

export interface CachedMeshEntry {
  meshData: AirspaceMeshData;
  groundSignature?: number;
  meshLod: number;
}

export const MAX_MESH_CACHE_SIZE = 400;

/**
 * Returns a stable cache key for an airspace mesh.
 * Overridable airspaces (`id <= RESERVED_AIRSPACE_ID_MAX`) incorporate their dynamic attributes
 * (vertical bounds, class, type) so any date override change automatically resolves to its own cached mesh
 * without manual cache purges. Normal and merged airspaces use their numeric `id` directly.
 */
export function getAirspaceMeshCacheKey(airspace: AirspaceTyped): number | string {
  return airspace.id <= RESERVED_AIRSPACE_ID_MAX
    ? `${airspace.id}:${airspace.floorM}:${airspace.topM}:${airspace.icaoClass}:${airspace.type}`
    : airspace.id;
}

/**
 * Bounded LRU/FIFO cache for generated 3D airspace meshes.
 * Encapsulates self-invalidating key resolution for overridable airspaces and LOD matching.
 */
export class AirspaceMeshCache {
  private map = new globalThis.Map<number | string, CachedMeshEntry>();

  constructor(private readonly maxSize = MAX_MESH_CACHE_SIZE) {}

  get(airspace: AirspaceTyped, targetLod?: number): CachedMeshEntry | undefined {
    const key = getAirspaceMeshCacheKey(airspace);
    const entry = this.map.get(key);
    if (entry && (targetLod == null || entry.meshLod === targetLod)) {
      return entry;
    }
    return undefined;
  }

  set(airspace: AirspaceTyped, entry: CachedMeshEntry): void {
    setBoundedCache(this.map, this.maxSize, getAirspaceMeshCacheKey(airspace), entry);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
