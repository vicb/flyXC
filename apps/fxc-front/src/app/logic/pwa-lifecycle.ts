/**
 * PWA Service Worker lifecycle management and update coordination.
 *
 * This module coordinates automatic app updates without prompting the user while fixing:
 * 1. Redundant reloads: Avoids reloading when the page was already loaded fresh from the network
 *    with the same build timestamp as the newly activated service worker.
 * 2. Cascading reload loops: Guards against rapid reloads from multiple tabs, DevTools "Update on reload",
 *    or race conditions between client claiming and cache cleanup.
 * 3. Cache exclusions: Ensures service worker scripts (/sw.js) are never trapped in runtime CacheFirst.
 */

export const INDEX_ROUTES = ['/', '/adm', '/arc', '/devices', '/3d'] as const;

export const KEY_LAST_RELOAD_TIME = 'fxc_sw_last_reload_time';
export const KEY_LAST_RELOAD_VERSION = 'fxc_sw_last_reload_version';

/** Minimum interval between automatic reloads (10 seconds) to prevent reload loops. */
export const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Checks whether a URL pathname corresponds to an index navigation route.
 * Normalizes trailing slashes (e.g., '/3d/' -> '/3d').
 */
export function isIndexRouteUrl(pathname: string): boolean {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return (INDEX_ROUTES as readonly string[]).includes(normalized);
}

/**
 * Determines whether a given URL is a cacheable static frontend asset.
 *
 * Excludes:
 * - Service worker scripts (/sw.js, /sw.mjs) so update checks are never cached by CacheFirst.
 * - Dynamic API endpoints (/api/, /oauth/).
 * - Cloudflare internals (/cdn-cgi/).
 * - Screenshots and icon variants that should not inflate the asset cache.
 * - Same-host query variants (?v=..., ?code=...).
 * - Non-asset, unmanifested resources.
 *
 * Admits:
 * - URLs in the generated build manifest (when manifestURLs is provided).
 * - Explicitly required static assets under /static/ or root static files (/favicon.ico, /manifest.webmanifest).
 */
export function isCacheableAssetUrl(url: URL, assetHost: string, manifestURLs?: ReadonlySet<string>): boolean {
  // Service worker files must NEVER be cached by the service worker's runtime CacheFirst.
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/sw.mjs')) {
    return false;
  }

  // Exclude non-cacheable paths and dynamic APIs
  if (
    url.pathname.startsWith('/cdn-cgi/') ||
    url.pathname.startsWith('/static/screenshots/') ||
    url.pathname.startsWith('/static/iconx/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/oauth/')
  ) {
    return false;
  }

  // Must match the asset host.
  if (url.host !== assetHost) {
    return false;
  }

  // Exclude same-host query variants (static assets are immutable and content-hashed without query parameters).
  if (url.search) {
    return false;
  }

  // If manifest URLs are available, admit any generated manifest asset.
  if (manifestURLs?.has(url.href)) {
    return true;
  }

  // Otherwise, admit explicitly required static assets.
  return (
    url.pathname.startsWith('/static/') || url.pathname === '/favicon.ico' || url.pathname === '/manifest.webmanifest'
  );
}

/**
 * Removes obsolete cached assets from a cache bucket when they are no longer in the valid set.
 *
 * @param name The cache storage name.
 * @param validURLs Set of URL strings that should be kept in cache.
 * @param isDebug Whether to log debug messages.
 */
export async function cleanupOldCache(name: string, validURLs: Set<string>, isDebug = false): Promise<void> {
  const cache = await caches.open(name);
  const requests = await cache.keys();
  for (const request of requests) {
    if (!validURLs.has(request.url)) {
      if (isDebug) {
        console.log(`Checking cache entry to be removed: ${request.url}`);
      }
      const deleted = await cache.delete(request);
      if (isDebug) {
        if (deleted) {
          console.log(`Precached data removed: ${request.url || request}`);
        } else {
          console.log(`No precache found: ${request.url || request}`);
        }
      }
    }
  }
}

/**
 * Communicates with the active service worker to retrieve its build timestamp.
 */
export async function getServiceWorkerVersion(timeoutMs = 1000): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const targetWorker = navigator.serviceWorker.controller || registration?.active;

    if (!targetWorker) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), timeoutMs);

      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data?.version ?? null);
      };

      targetWorker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  } catch {
    return null;
  }
}

export interface ServiceWorkerReloadOptions {
  /** The version of the service worker (defaults to querying the worker). */
  swVersion?: string;
  /** The current page's build timestamp (defaults to __BUILD_TIMESTAMP__). */
  currentBuildTimestamp?: string;
  /** Storage interface used for tracking reloads (defaults to globalThis.sessionStorage). */
  storage?: Storage;
  /** Function to trigger a page reload (defaults to window.location.reload). */
  locationReload?: () => void;
  /** Current online status (defaults to navigator.onLine). */
  isOnline?: boolean;
  /** Current timestamp in ms (defaults to Date.now()). */
  now?: number;
}

/**
 * Handles service worker update notifications and determines if a page reload is necessary and safe.
 *
 * Returns true if a reload was triggered, or false if it was skipped (e.g., redundant or throttled).
 */
export async function handleServiceWorkerReload(options: ServiceWorkerReloadOptions = {}): Promise<boolean> {
  const isOnline = options.isOnline ?? navigator?.onLine ?? true;
  if (!isOnline) {
    // Reloading while offline will not retrieve fresh assets from the network.
    return false;
  }

  const currentBuildTimestamp = options.currentBuildTimestamp ?? __BUILD_TIMESTAMP__ ?? '';
  const swVersion = options.swVersion ?? (await getServiceWorkerVersion());

  // 1. Redundant reload prevention:
  // If the service worker's build timestamp matches the current page's build timestamp,
  // the page was already loaded fresh via NetworkFirst navigation with the latest assets.
  // Reloading would flash the screen with zero benefit.
  if (swVersion && currentBuildTimestamp && swVersion === currentBuildTimestamp) {
    return false;
  }

  const storage = options.storage ?? globalThis.sessionStorage;
  const now = options.now ?? Date.now();

  if (storage) {
    // 2. Cascade / Loop prevention:
    // Ensure at least RELOAD_COOLDOWN_MS has elapsed since the last automatic reload in this tab session.
    const lastReloadTime = Number(storage.getItem(KEY_LAST_RELOAD_TIME) || '0');
    if (now - lastReloadTime < RELOAD_COOLDOWN_MS) {
      return false;
    }

    // 3. Single-reload-per-version guarantee:
    // If this tab session already reloaded for this specific service worker version, skip further reloads.
    if (swVersion && storage.getItem(KEY_LAST_RELOAD_VERSION) === swVersion) {
      return false;
    }

    storage.setItem(KEY_LAST_RELOAD_TIME, String(now));
    if (swVersion) {
      storage.setItem(KEY_LAST_RELOAD_VERSION, swVersion);
    }
  }

  const locationReload = options.locationReload ?? (() => window.location.reload());
  locationReload();
  return true;
}
