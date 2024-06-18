/**
 * flyXC service worker.
 */

import type { ManifestEntry } from 'workbox-build';
import { clientsClaim } from 'workbox-core';
import { googleFontsCache } from 'workbox-recipes';
import { registerRoute, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<ManifestEntry> };

const FLYXC_ASSET_CACHE_NAME = 'flyxc-cache-v1';
const debug = process.env.NODE_ENV === 'development';

// Try to get the index page from the network.
const isIndexRoute = ({ url }: { url: URL }): boolean => {
  return ['/', '/adm', '/arc', '/devices'].includes(url.pathname);
};
registerRoute(isIndexRoute, new NetworkFirst({ cacheName: FLYXC_ASSET_CACHE_NAME, networkTimeoutSeconds: 10 }));

// Get all other assets from the cache first.
const flyxcAssetHost = new URL(import.meta.env.VITE_APP_SERVER).host;
const isCacheableAsset = ({ url }: { url: URL }) => {
  if (
    // Cloudflare
    url.pathname.startsWith('/cdn-cgi/') ||
    url.pathname.startsWith('/static/screenshots/') ||
    url.pathname.startsWith('/static/iconx/') ||
    // Testing for /api and /oauth is not strictly required.
    // It can help in dev mode and as a safeguard.
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/oauth/')
  ) {
    return false;
  }

  return url.host === flyxcAssetHost;
};
registerRoute(isCacheableAsset, new CacheFirst({ cacheName: FLYXC_ASSET_CACHE_NAME }));

// Cache Google Fonts.
googleFontsCache();

// Fallback to the network.
setDefaultHandler(new NetworkOnly());

const manifest = self.__WB_MANIFEST;

const manifestURLs = new Set(
  manifest.map((entry) => {
    const url = new URL(entry.url, String(self.location));
    return url.href;
  }),
);

async function cleanupOldCache(name: string, debug = false): Promise<any> {
  const cache = await caches.open(name);
  const requests = await cache.keys();
  for (const request of requests) {
    if (!manifestURLs.has(request.url)) {
      console.log(`Checking cache entry to be removed: ${request.url}`);
      const deleted = await cache.delete(request);
      if (debug) {
        if (deleted) {
          console.log(`Precached data removed: ${request.url || request}`);
        } else {
          console.log(`No precache found: ${request.url || request}`);
        }
      }
    }
  }
}

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(cleanupOldCache(FLYXC_ASSET_CACHE_NAME, debug));
});

// The new service worker will keep on skipWaiting state
// and then, caches will not be cleared since it is not activated
self.skipWaiting();
clientsClaim();
