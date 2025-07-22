import type { Platform } from '@windy/types';
export interface LocationEntityServices {
  storms: {
    enabled: boolean;
  };
  rain: {
    enabled: boolean;
  };
  tc?: {
    enabled: boolean;
  };
  cap?: {
    enabled: boolean;
  };
}
export type DistanceUnit = 'km' | 'mi' | 'NM';
export interface LocationEntity {
  services: LocationEntityServices;
  platform: Platform;
  deviceToken: string;
  language: string;
  lat?: number;
  locationEntityId?: string;
  lon?: number;
  units: {
    distance: DistanceUnit;
  };
}
