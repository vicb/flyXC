import type { VitePWAOptions } from 'vite-plugin-pwa';

export const getPwaConfig: (mode?: string) => Partial<VitePWAOptions> = (mode = 'production') => ({
  injectRegister: 'auto',
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,jpg,woff,woff2,glb}'],
    navigateFallback: 'index.htm',
  },
  // Most flexible strategy to implement advanced features.
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    // ArcGIS 3D is 3.8 MB
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    minify: mode == 'production',
  },
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
});
