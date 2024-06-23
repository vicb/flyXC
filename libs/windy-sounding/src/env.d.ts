/// <reference types="vite/client" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="leaflet.d.ts" />

declare const __BUILD_TIMESTAMP__: number;

declare const SwipeListener: any;

/* eslint-disable */
declare const W: {
  store: typeof import('@windy/client/store').default;
  utils: typeof import('@windy/client/utils');
  fetch: typeof import('@windy/client/fetch');
  subscription: typeof import('@windy/client/subscription');
  products: typeof import('@windy/client/products').default;
  metrics: typeof import('@windy/client/metrics').default;
  models: typeof import('@windy/client/models');
  rootScope: typeof import('@windy/rootScope.d');
  map: typeof import('@windy/client/map');
  singleclick: typeof import('@windy/client/singleclick');
  location: typeof import('@windy/client/location');
  userFavs: typeof import('@windy/client/userFavs').default;
  picker: typeof import('@windy/client/picker');
  broadcast: typeof import('@windy/client/broadcast').default;
};
/* eslint-enable */

declare module '*.svelte' {
  import type { ComponentType } from 'svelte';

  const component: ComponentType;
  export default component;
}
