import { LatLon } from '@windy/interfaces.d';
import { Pois } from '@windy/rootScope.d';
import { Pixel, ExternalPluginIdent } from '@windy/types.d';
import { PluginIdent } from '@windy/Plugin';

export interface SingleClickParams extends LatLon {
  x: Pixel;
  y: Pixel;
  source: 'singleclick';
}

type SingleclickPoiTypes = {
  [key in `poi-${Pois | 'stations' | 'label'}`]: [HTMLElement];
};

export type SingleclickPluginTypes = {
  [key in PluginIdent]: [SingleClickParams];
};

export type SingleclickEternalPluginTypes = {
  [key in ExternalPluginIdent]: [SingleClickParams];
};

export interface SingleclickTypes extends SingleclickPoiTypes, SingleclickPluginTypes, SingleclickEternalPluginTypes {
  click: [SingleClickParams];
}

export type ListeningPriority = 'high' | 'low';
