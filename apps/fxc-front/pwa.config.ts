import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaConfig: Partial<VitePWAOptions> = {
  injectRegister: 'auto',
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,jpg,woff,woff2,glb}'],
    // ArcGIS 3D is ~3.9MB.
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    navigateFallback: 'index.html',
  },
  // Most flexible strategy to implement advanced features.
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  manifest: {
    name: 'flyXC',
    short_name: 'flyXC',
    description: 'One stop shop app for paraglider pilots.',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  devOptions: {
    enabled: true,
  },
};
