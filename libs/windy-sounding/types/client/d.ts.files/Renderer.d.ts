import { TransformFunction } from '@windy/Layer.d';
import { TilePoint } from '@windy/interfaces.d';

import type { BottomSveltePlugins, Plugins, SveltePlugins } from '@windy/plugins.d';

export type AllowedRenderPlugins = Pick<
  Plugins,
  'radar' | 'satellite' | 'radar-plus' | 'cap-alerts' | 'isolines' | 'gl-particles' | 'particles'
>;

export type Renderers =
  | 'tileLayer'
  | 'radar'
  | 'satellite'
  | 'radarPlus'
  | 'capAlerts'
  | 'isolines'
  | 'particles'
  | 'accumulations'
  | 'daySwitcher'
  | 'noUserControl'
  | 'topoMap';

export interface TileParams extends TilePoint {
  url: string;
  intX: number;
  intY: number;
  trans: number;
  transformR: TransformFunction | null;
  transformG: TransformFunction | null;
  transformB: TransformFunction | null;
}

export type AllowedUserControls = keyof BottomSveltePlugins | keyof SveltePlugins | 'map-selector' | 'none';

export interface RendererInitParams {
  ident: Renderers;
  dependency?: keyof AllowedRenderPlugins;
  userControl?: AllowedUserControls;
}
