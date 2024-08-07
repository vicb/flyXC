import type { VitePWAOptions } from 'vite-plugin-pwa';

export const getPwaConfig: (mode?: string) => Partial<VitePWAOptions> = (mode = 'production') => ({
  injectRegister: 'auto',
  registerType: 'autoUpdate',
  workbox: {
    navigateFallback: 'index.html',
  },
  // Most flexible strategy to implement advanced features.
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    // ArcGIS 3D is 3.8 MB
    maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
    minify: mode === 'production',
    globPatterns: ['**/*.{js,css,html,png,svg,jpg,woff,woff2,glb}'],
    globIgnores: ['**/iconx/*.*', '**/screenshots/*.*'],
    dontCacheBustURLsMatching: /-\w{8}\.js/,
  },
  devOptions: {
    enabled: true,
    type: 'module',
  },
  manifest: {
    name: 'flyXC',
    short_name: 'flyXC',
    description: 'One stop shop app for paraglider pilots.',
    background_color: '#ffffff',
    theme_color: '#0054e9',
    shortcuts: [
      {
        name: '3D view',
        url: '/3d',
        icons: [
          {
            src: 'static/iconx/globe-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],
    icons: [
      {
        src: 'static/iconx/pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'static/iconx/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'static/iconx/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'static/iconx/pwa-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },

      {
        src: 'static/iconx/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: 'static/screenshots/wide-2d.jpg',
        label: '2D view',
        form_factor: 'wide',
        sizes: '1919x1043',
        type: 'image/jpg',
      },
      {
        src: 'static/screenshots/wide-3d.jpg',
        label: '3D view',
        form_factor: 'wide',
        sizes: '1919x1043',
        type: 'image/jpg',
      },
      {
        src: 'static/screenshots/wide-planner.jpg',
        label: 'XC planning',
        form_factor: 'wide',
        sizes: '1919x1043',
        type: 'image/jpg',
      },
      {
        src: 'static/screenshots/narrow-2d.jpg',
        label: '2D view',
        form_factor: 'narrow',
        sizes: '334x743',
        type: 'image/jpg',
      },
      {
        src: 'static/screenshots/narrow-3d.jpg',
        label: '3D view',
        form_factor: 'narrow',
        sizes: '334x743',
        type: 'image/jpg',
      },
      {
        src: 'static/screenshots/narrow-planner.jpg',
        label: 'XC planning',
        form_factor: 'narrow',
        sizes: '334x743',
        type: 'image/jpg',
      },
    ],
  },
});
