import { EtagMismatch, PMTiles, SharedPromiseCache, type Source } from 'pmtiles';

export { EtagMismatch, PMTiles, type Source as PmtilesSource } from 'pmtiles';

const PMTILES_REQUEST_TIMEOUT_MS = 15_000;

const pmtilesClients = new Map<string, PMTiles>();
const pmtilesSourceFactories = new Map<string, (url: string) => Source>();

/**
 * Registers a custom PMTiles `Source` factory for `url` (e.g. authenticated R2 S3 reads in `apps/run`).
 */
export function setPmtilesSourceFactory(url: string, factory: (url: string) => Source): void {
  pmtilesSourceFactories.set(url, factory);
  pmtilesClients.delete(url);
}

function evictPmtilesClient(url: string, client: PMTiles): void {
  if (pmtilesClients.get(url) === client) {
    pmtilesClients.delete(url);
  }
}

// Give each byte range its own URL (?r=offset-length&v=etag) so Chrome's HttpCache caches ranges
// independently without lock contention, and revalidate the initial header once per client.
class TimeoutFetchSource implements Source {
  constructor(private readonly url: string) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string) {
    const url = new URL(this.url);
    url.searchParams.set('r', `${offset}-${length}`);
    if (etag && !url.searchParams.has('v')) {
      url.searchParams.set('v', etag);
    }
    const timeout = AbortSignal.timeout(PMTILES_REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      // Revalidate the initial header/root-dir once per client so ETag updates are seen immediately.
      cache: etag ? undefined : 'no-cache',
    });

    const rawEtag = res.headers.get('etag');
    // Ignore weak ETags (W/) as they don't guarantee byte-range identity; strip quotes for clean URL params.
    const respEtag = rawEtag && !rawEtag.startsWith('W/') ? rawEtag.replaceAll('"', '') : undefined;
    if (res.status === 412 || res.status === 416 || (etag && respEtag && respEtag !== etag)) {
      throw new EtagMismatch(respEtag);
    }
    if (!res.ok) {
      throw new Error(`Bad response code: ${res.status}`);
    }
    return { data: await res.arrayBuffer(), etag: respEtag };
  }
}

// Attach a rejection handler to SharedPromiseCache's detached invalidation promise so Node doesn't crash on failed refreshes.
class SafePromiseCache extends SharedPromiseCache {
  override invalidate(source: Source): Promise<void> {
    const p = super.invalidate(source);
    this.invalidations.get(source.getKey())?.catch(() => undefined);
    return p;
  }
}

export function getPmtilesClient(url: string, bustCache = false): PMTiles {
  let client = bustCache ? undefined : pmtilesClients.get(url);
  if (!client) {
    const fetchUrl = bustCache ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}` : url;
    const source = pmtilesSourceFactories.get(url)?.(fetchUrl) ?? new TimeoutFetchSource(fetchUrl);
    client = new PMTiles(source, new SafePromiseCache());
    pmtilesClients.set(url, client);
  }
  return client;
}

export function resetPmtilesClient(url: string): void {
  pmtilesClients.delete(url);
}

/**
 * Fetches a tile from a PMTiles archive, automatically resetting the cached client
 * and retrying once if an ETag mismatch occurs during an in-place archive update.
 */
export async function fetchPmtilesTile(
  url: string,
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal,
  onEtagMismatch?: () => void,
): Promise<ArrayBuffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = getPmtilesClient(url, attempt > 0);
    try {
      const res = await client.getZxy(z, x, y, signal);
      return res?.data ?? null;
    } catch (err) {
      evictPmtilesClient(url, client);
      if (attempt === 0 && err instanceof EtagMismatch) {
        onEtagMismatch?.();
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * Extracts `{ date, timestamp }` from PMTiles JSON metadata (including Tippecanoe's `description`).
 */
export function parseAirspaceMetadata(metadata: unknown): { date?: string; timestamp?: number | string } | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const meta = metadata as { description?: string; date?: string; timestamp?: number | string };
  if (typeof meta.description === 'string') {
    try {
      const parsed = JSON.parse(meta.description) as { date?: string; timestamp?: number | string };
      if (parsed && (parsed.date != null || parsed.timestamp != null)) {
        return parsed;
      }
    } catch {
      // description is not JSON
    }
  }
  return meta.date != null || meta.timestamp != null ? { date: meta.date, timestamp: meta.timestamp } : undefined;
}

/**
 * Fetches and parses `{ date, timestamp }` from a PMTiles archive's JSON metadata.
 */
export async function getPmtilesMetadata(
  url: string,
  bustCache = false,
): Promise<{ date?: string; timestamp?: number | string } | undefined> {
  const client = getPmtilesClient(url, bustCache);
  const metadata = await client.getMetadata().catch(() => {
    evictPmtilesClient(url, client);
    return null;
  });
  return parseAirspaceMetadata(metadata);
}

/**
 * Returns a version string for a PMTiles archive (live ETag via `HEAD`, or metadata timestamp/date fallback).
 */
export async function getPmtilesVersion(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(PMTILES_REQUEST_TIMEOUT_MS),
    });
    const etag = res.ok ? res.headers.get('etag') : null;
    if (etag) {
      return etag;
    }
  } catch {
    // Fall back to PMTiles metadata if HEAD fails or is unsupported.
  }
  const parsed = await getPmtilesMetadata(url, true);
  return parsed?.timestamp != null ? String(parsed.timestamp) : parsed?.date;
}
