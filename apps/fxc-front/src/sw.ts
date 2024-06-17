/**
 * flyXC service worker.
 */

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// Auto updates.
self.skipWaiting();
clientsClaim();

// Clear outdated cache assets after updates.
cleanupOutdatedCaches();

// Precache all assets (injected by the build system).
precacheAndRoute(self.__WB_MANIFEST);

// To allow work offline
if (process.env.NODE_ENV === 'production') {
  let allowlist: undefined | RegExp[];
  if (import.meta.env.DEV) {
    allowlist = [/^\/$/];
  }

  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { allowlist }));
}
