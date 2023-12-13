/// <reference types="vite/client" />

import { AirspaceServer } from '@flyxc/common';

interface ImportMetaEnv {
  VITE_AIRSPACE_SERVER: AirspaceServer;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  var __BUILD_TIMESTAMP__: string;
  var __AIRSPACE_DATE__: string;
}
