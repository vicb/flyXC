import type { RouteType, StationId, Timestamp } from '@windy/types';
import type { LatLon, Alert, AlertProps } from '@windy/interfaces';

export type FavId = string;

/** New fav type not including alerts */
export type FavTypeNew = 'fav' | 'airport' | 'station' | 'webcam' | 'route';

/** @deprecated Old fav type including alert that will be abandoned soon */
export type FavType = FavTypeNew | 'alert';

export type RouteAsString = `${RouteType}/${string}`;

export type FavFragment =
  | (LatLon & {
      /** Title of the fav */
      title: string;
    }) &
      (
        | { type: 'fav' }

        /** @deprecated use till migration of alerts is in process */
        | {
            type: 'alert';
            alert: Alert;
            alertProps: AlertProps;
          }

        /** Airport ICAO code in case of airport */
        | { type: 'airport'; icao: string }

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

export type ObsoleteFav = FavFragment & {
  key: string;
};

export type FavQuery =
  | { webcamsId: number }
  | { stationId: StationId }
  | { icao: string }
  | { type: FavType }
  | { title: string };
