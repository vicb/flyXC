/// <reference types="vite/client" />
/// <reference types="@types/gtag.js" />

import type { AirspaceServer } from '@flyxc/common';

interface ImportMetaEnv {
  VITE_AIRSPACE_SERVER: AirspaceServer;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  const __BUILD_TIMESTAMP__: string;
  const __AIRSPACE_DATE__: string;
}
