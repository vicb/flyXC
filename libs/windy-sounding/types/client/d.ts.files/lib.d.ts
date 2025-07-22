/* eslint-disable */
// @ts-ignore
// @ts-nocheck

import type { DataSpecifications } from '@windy/dataSpecifications.d';
import type { LatLon } from '@windy/interfaces';
import type { PluginsOpenParams } from '@windy/plugin-params';

export type LibHtml = string;

type AllowedDataSpecifications = Pick<
  DataSpecifications,
  | 'overlay'
  | 'level'
  | 'particles'
  | 'numDirection'
  | 'lang'
  | 'disableWebGL'
  | 'graticule'
  | 'particlesAnim'
  | 'timestamp'
  | 'isolines'
  | 'isImperial'
  | 'latlon'
  | 'hourFormat'
  | 'favOverlays'
  | 'expertMode'
  | 'product'
>;
export type WindyAPIOptions = Partial<{
  [P in keyof AllowedDataSpecifications]: AllowedDataSpecifications[P]['def'];
}>;

export interface InitOptions extends WindyAPIOptions {
  key?: string;
  verbose?: boolean;

  lat?: number;
  lon?: number;
  lng?: number;
  zoom?: number;
}

type ApiPicker = typeof import('@windy/picker') & {
  open: (latLon: LatLon) => void;
  close: () => void;
  getParams: () => PluginsOpenParams['picker'];
};

export type InitCb = (windyAPI: {
  map: WModules['map']['map'];
  store: WModules['store'];
  picker: ApiPicker;
  utils: WModules['utils'];
  broadcast: WModules['broadcast'];
  overlays: WModules['overlays'];
  colors: WModules['colors'];
}) => void;

export interface ApiAuthResponse {
  domains: string;
  paid: boolean;
  id: string;
  name: string;
  type: string;
  exceeded: boolean;
  auth: string;
  features: {
    intersucho?: boolean;
    ecmwf?: boolean;
  };
}
