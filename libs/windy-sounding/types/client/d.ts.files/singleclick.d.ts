import { LatLon } from '@windy/interfaces.d';
import { Pois } from '@windy/rootScope.d';
import { Pixel, ExternalPluginIdent } from '@windy/types.d';
import { PluginIdent } from '@windy/Plugin';

export interface SingleClickParams extends LatLon {
  x: Pixel;
  y: Pixel;
  source: 'singleclick';
}

type PoiKeys = `poi-${Pois | 'stations' | 'label'}`;

type SingleclickPoiTypes = {
  [key in PoiKeys]: [HTMLElement];
};

export type SingleclickPluginTypes = {
  [key in Exclude<PluginIdent, PoiKeys>]: [SingleClickParams];
};

export type SingleclickEternalPluginTypes = {
  [key in ExternalPluginIdent]: [SingleClickParams];
};

export interface SingleclickTypes extends SingleclickPoiTypes, SingleclickPluginTypes, SingleclickEternalPluginTypes {
  click: [SingleClickParams];
}

export type ListeningPriority = 'high' | 'low';
