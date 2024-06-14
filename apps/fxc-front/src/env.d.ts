/// <reference types="vite/client" />
/// <reference types="@types/gtag.js" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="vite-plugin-pwa/info" />

import type { AirspaceServer } from '@flyxc/common';

interface ImportMetaEnv {
  VITE_AIRSPACE_SERVER: AirspaceServer;
  VITE_API_SERVER: string;
  VITE_APP_SERVER: string;
  VITE_GMAPS_API_KEY: string;
  VITE_IGNFR_API_KEY: string;
  VITE_ARCGIS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  const __BUILD_TIMESTAMP__: string;
  const __AIRSPACE_DATE__: string;
}
