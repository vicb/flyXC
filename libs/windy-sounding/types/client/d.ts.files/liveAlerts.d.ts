import type { Platform } from '@windy/types';

export interface LocationEntityServices {
    storms: {
        enabled: boolean;
    };
    rain: {
        enabled: boolean;
    };
    // For some reason, BE uses unclear acronym instead of tropicalCyclones
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
