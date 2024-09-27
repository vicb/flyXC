import { Overlays, Levels } from '@windy/rootScope.d';
import { Bounds } from '@windy/interfaces.d';

export type ProductKey = `lastMinifest/${string}`; // TODO - directory instead of string

export interface ProductParam {
  color: [number, number[]][];
  description_en: string;
  name_en: string;
  encoding: {
    func: string; // TODO: set exact function names
    zero: number;
  };
  level: Levels[];
  units: string;
}

export interface ProductInfoJson {
  about: {
    name: string;
    copyright: string;
    description: string;
    modelResolution: number;
    provider: string;
    url: string;
  };
  bounds: null | Bounds;
  interval: number;
  maxZoom: number;
  param: Record<Overlays, ProductParam>;
  version: string;
  zoom2zoom: string; // TODO: set exact string
}

export type DataQuality = 'normal' | 'high' | 'low' | 'ultra' | 'extreme';

export type FileSuffix = 'png' | 'jpg' | 'webp';
