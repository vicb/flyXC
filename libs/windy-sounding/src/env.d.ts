/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: number;

declare module '*.svelte' {
  import type { ComponentType } from 'svelte';

  const component: ComponentType;
  export default component;
}

declare module '@windycom/plugin-devtools';
