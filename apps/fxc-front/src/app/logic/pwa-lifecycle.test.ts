import { describe, expect, it, vi } from 'vitest';

import {
  cleanupOldCache,
  getServiceWorkerVersion,
  handleServiceWorkerReload,
  isCacheableAssetUrl,
  isIndexRouteUrl,
  KEY_LAST_RELOAD_TIME,
  KEY_LAST_RELOAD_VERSION,
  RELOAD_COOLDOWN_MS,
} from './pwa-lifecycle';

describe('isIndexRouteUrl', () => {
  it('identifies index navigation routes', () => {
    expect(isIndexRouteUrl('/')).toBe(true);
    expect(isIndexRouteUrl('/adm')).toBe(true);
    expect(isIndexRouteUrl('/arc')).toBe(true);
    expect(isIndexRouteUrl('/devices')).toBe(true);
    expect(isIndexRouteUrl('/3d')).toBe(true);
  });

  it('handles trailing slashes on index routes', () => {
    expect(isIndexRouteUrl('/3d/')).toBe(true);
    expect(isIndexRouteUrl('/adm/')).toBe(true);
    expect(isIndexRouteUrl('/devices/')).toBe(true);
  });

  it('rejects non-index routes', () => {
    expect(isIndexRouteUrl('/static/js/index.js')).toBe(false);
    expect(isIndexRouteUrl('/api/tracks')).toBe(false);
    expect(isIndexRouteUrl('/other')).toBe(false);
    expect(isIndexRouteUrl('/3d/subpath')).toBe(false);
  });
});

describe('isCacheableAssetUrl', () => {
  const assetHost = 'flyxc.app';

  it('never caches service worker scripts', () => {
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/sw.js'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/sw.mjs'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/nested/sw.js'), assetHost)).toBe(false);
  });

  it('excludes excluded directories and APIs', () => {
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/cdn-cgi/trace'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/screenshots/wide-2d.jpg'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/iconx/pwa-192x192.png'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/api/tracks'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/oauth/login'), assetHost)).toBe(false);
  });

  it('rejects cross-origin requests', () => {
    expect(isCacheableAssetUrl(new URL('https://other-domain.com/static/js/app.js'), assetHost)).toBe(false);
  });

  it('allows cacheable same-origin static assets', () => {
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/js/index-abc.js'), assetHost)).toBe(true);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/css/index-123.css'), assetHost)).toBe(true);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/models/ufo.glb'), assetHost)).toBe(true);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/favicon.ico'), assetHost)).toBe(true);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/manifest.webmanifest'), assetHost)).toBe(true);
  });

  it('excludes same-host query variants', () => {
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/static/js/index-abc.js?v=123'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/?code=oauth-token'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/3d?track=456'), assetHost)).toBe(false);
  });

  it('rejects arbitrary unmanifested non-static resources on the host', () => {
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/terms'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/privacy'), assetHost)).toBe(false);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/unknown-route'), assetHost)).toBe(false);
  });

  it('admits generated-manifest URLs when manifestURLs set is provided', () => {
    const manifestSet = new Set(['https://flyxc.app/custom-manifest-asset.json']);
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/custom-manifest-asset.json'), assetHost, manifestSet)).toBe(
      true,
    );
    expect(isCacheableAssetUrl(new URL('https://flyxc.app/not-in-manifest.json'), assetHost, manifestSet)).toBe(false);
  });
});

describe('handleServiceWorkerReload', () => {
  function createMockStorage(): Storage {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  it('does not reload when offline', async () => {
    const locationReload = vi.fn();
    const storage = createMockStorage();

    const reloaded = await handleServiceWorkerReload({
      isOnline: false,
      swVersion: '20260918-1200',
      currentBuildTimestamp: '20260917-0800',
      storage,
      locationReload,
    });

    expect(reloaded).toBe(false);
    expect(locationReload).not.toHaveBeenCalled();
  });

  it('skips reload when the page is already running the SW build version (redundant reload fix)', async () => {
    const locationReload = vi.fn();
    const storage = createMockStorage();

    const reloaded = await handleServiceWorkerReload({
      isOnline: true,
      swVersion: '20260918-1200',
      currentBuildTimestamp: '20260918-1200',
      storage,
      locationReload,
    });

    expect(reloaded).toBe(false);
    expect(locationReload).not.toHaveBeenCalled();
    expect(storage.getItem(KEY_LAST_RELOAD_TIME)).toBeNull();
  });

  it('reloads when the service worker has a newer/different build version', async () => {
    const locationReload = vi.fn();
    const storage = createMockStorage();
    const now = 1_000_000;

    const reloaded = await handleServiceWorkerReload({
      isOnline: true,
      swVersion: '20260918-1200',
      currentBuildTimestamp: '20260917-0800',
      storage,
      locationReload,
      now,
    });

    expect(reloaded).toBe(true);
    expect(locationReload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(KEY_LAST_RELOAD_VERSION)).toBe('20260918-1200');
    expect(storage.getItem(KEY_LAST_RELOAD_TIME)).toBe(String(now));
  });

  it('prevents cascading reload loops: skips reload if already reloaded for this version', async () => {
    const locationReload = vi.fn();
    const storage = createMockStorage();
    storage.setItem(KEY_LAST_RELOAD_VERSION, '20260918-1200');
    storage.setItem(KEY_LAST_RELOAD_TIME, '1000000');

    const reloaded = await handleServiceWorkerReload({
      isOnline: true,
      swVersion: '20260918-1200',
      currentBuildTimestamp: '20260917-0800',
      storage,
      locationReload,
      now: 1_000_000 + RELOAD_COOLDOWN_MS + 5000,
    });

    expect(reloaded).toBe(false);
    expect(locationReload).not.toHaveBeenCalled();
  });

  it('prevents rapid reload loops within cooldown interval', async () => {
    const locationReload = vi.fn();
    const storage = createMockStorage();
    const initialTime = 1_000_000;
    storage.setItem(KEY_LAST_RELOAD_TIME, String(initialTime));

    const reloaded = await handleServiceWorkerReload({
      isOnline: true,
      swVersion: '20260918-1300',
      currentBuildTimestamp: '20260917-0800',
      storage,
      locationReload,
      now: initialTime + 3000, // only 3s elapsed (< 10s cooldown)
    });

    expect(reloaded).toBe(false);
    expect(locationReload).not.toHaveBeenCalled();
  });
});

describe('getServiceWorkerVersion', () => {
  it('returns null if navigator.serviceWorker is absent', async () => {
    const originalSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const version = await getServiceWorkerVersion();
    expect(version).toBeNull();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
      writable: true,
    });
  });

  it('queries version from active service worker controller via MessageChannel', async () => {
    const mockController = {
      postMessage: vi.fn((message, [port]: [any, MessagePort]) => {
        if (message.type === 'GET_VERSION') {
          // Simulate service worker posting back the version
          port.postMessage({ version: '20260918-1234' });
        }
      }),
    };

    const originalSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: mockController,
        getRegistration: vi.fn().mockResolvedValue({ active: mockController }),
      },
      configurable: true,
      writable: true,
    });

    const version = await getServiceWorkerVersion(500);
    expect(version).toBe('20260918-1234');
    expect(mockController.postMessage).toHaveBeenCalledWith(
      { type: 'GET_VERSION' },
      expect.arrayContaining([expect.anything()]),
    );

    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
      writable: true,
    });
  });
});

describe('cleanupOldCache', () => {
  it('deletes cached items that are not in validURLs set and keeps valid items', async () => {
    const deletedUrls: string[] = [];
    const mockKeys = [
      { url: 'https://flyxc.app/static/js/current-abc.js' },
      { url: 'https://flyxc.app/static/js/outdated-xyz.js' },
    ];

    const mockCache = {
      keys: vi.fn().mockResolvedValue(mockKeys),
      delete: vi.fn().mockImplementation((req: { url: string }) => {
        deletedUrls.push(req.url);
        return Promise.resolve(true);
      }),
    };

    const originalCaches = globalThis.caches;
    // @ts-expect-error mocking global caches
    globalThis.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
    };

    const validURLs = new Set(['https://flyxc.app/static/js/current-abc.js']);
    await cleanupOldCache('flyxc-assets-v1', validURLs, false);

    expect(mockCache.delete).toHaveBeenCalledTimes(1);
    expect(deletedUrls).toEqual(['https://flyxc.app/static/js/outdated-xyz.js']);

    globalThis.caches = originalCaches;
  });
});
