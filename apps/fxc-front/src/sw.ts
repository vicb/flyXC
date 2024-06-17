/**
 * flyXC service worker.
 */

import { clientsClaim } from 'workbox-core';
import { registerRoute, setDefaultHandler } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, CacheFirst } from 'workbox-strategies';
import type { ManifestEntry } from 'workbox-build';

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
const isAsset = ({ url }: { url: URL }) => {
  // Testing for /api and /oauth is not strictly required.
  // It can help in dev mode and as a safeguard.
  return url.host === flyxcAssetHost && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/oauth/');
};
registerRoute(isAsset, new CacheFirst({ cacheName: FLYXC_ASSET_CACHE_NAME }));

// Fallback to the network.
setDefaultHandler(new NetworkOnly());

const manifest = self.__WB_MANIFEST;

const manifestURLs = new Set(
  manifest.map((entry) => {
    const url = new URL(entry.url, String(self.location));
    return url.href;
  }),
);

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(FLYXC_ASSET_CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        keys.forEach((request) => {
          if (debug) {
            console.log(`Checking cache entry to be removed: ${request.url}`);
          }
          if (!manifestURLs.has(request.url)) {
            cache.delete(request).then((deleted) => {
              if (debug) {
                if (deleted) {
                  console.log(`Precached data removed: ${request.url || request}`);
                } else {
                  console.log(`No precache found: ${request.url || request}`);
                }
              }
            });
          }
        });
      });
    }),
  );
});

// The new service worker will keep on skipWaiting state
// and then, caches will not be cleared since it is not activated
self.skipWaiting();
clientsClaim();
