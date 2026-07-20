import type { ISOCountryCode, RouteType, StationId, Timestamp } from '@windy/types';
import type { LatLon } from '@windy/interfaces';

export type FavId = string;

/** New fav type not including alerts */
export type FavType = 'fav' | 'airport' | 'station' | 'webcam' | 'route';

export type RouteAsString = `${RouteType}/${string}`;

export type FavFragment = (LatLon & {
    /** Title of the fav */
    title: string;

    /** Lowercase ISO 2 letter CC or xx if fav is in the ocean for example */
    cc?: ISOCountryCode | 'xx';
}) &
    (
        | { type: 'fav' }

        /** Airport ICAO code in case of airport */
        | { type: 'airport'; icao: string; iata?: string }

        /** Weather station ID (if WX station) */
        | { type: 'station'; stationId: StationId }
        | { type: 'webcam'; webcamId: number }
        | { type: 'route'; route: RouteAsString }
    );

export type Fav = FavFragment & {
    /** Unique mongoDb ID of item */
    id: FavId;

    /**
     * If user wants to pin to top this fav, this timestamp enable us to sort all the favs
     * so the last pinned is on top
     */
    pin2top?: Timestamp | null;

    /**
     * If user wants to pin to homepage this fav, this timestamp enable us to sort all the favs
     * so the last pinned is first in line
     */
    pin2homepage?: Timestamp | null;

    /**
     * Timestamp when the item has been updated for the last time. It is used for updating items on all devices (the most up-to-date wins)
     */
    updated: Timestamp;
};

export type FavQuery =
    | { webcamsId: number }
    | { stationId: StationId }
    | { icao: string }
    | { type: FavType }
    | { title: string };
