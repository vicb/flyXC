import type { Platform } from '@windy/types';

// In the future, the settings may look like this
// "services": {
//     "storms": {
//         "enabled": true,
//         "trackCurrentLocation": true,
//         "locations": [{ "lat": 1, "lon": 2 }]
//     },
//     "tornadoes": {
//         "enabled": true,
//         "minForce": "F5",
//         "trackCurrentLocation": true,
//     },
//     "earthquakes": {
//         "enabled": true,
//         "minMagnitude": 5,
//         "trackCurrentLocation": true,
//         "locations": [{ "lat": 1, "lon": 2 }]
//     }
// }
export interface LocationEntityServices {
    storms: {
        enabled: boolean;
    };
    rain: {
        enabled: boolean;
    };
    // TODO Enable for all when supported by BE
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
