import { Timestamp } from '@windy/types.d';

export type TimeFormatFunction = (hour: number, min?: number) => string;

export type DirectionFunction = (dir: number | string) => string;

// at lease one of them is required, that is why it is an interface intersection and union
export type HowOldOptions = (
    | {
          /**
           * Already calculated time difference in minutes (optional)
           */
          diffMin: number;
      }
    | {
          /**
           * Timestamp
           */
          ts: Timestamp;
      }
    | {
          /**
           * Timestamp in minutes (who the FUCK uses this?)
           */
          min: number;
      }
    | {
          /**
           * UNIX timestamp
           */
          ux: number;
      }
) & {
    /**
     * Should we localize output?
     */
    translate?: boolean;

    /**
     * Use 'ago' string for output
     */
    useAgo?: boolean;

    /**
     * (default: true) Future timestamps are displayed with `in ...`. If false, `now` string is used instead
     */
    useFuture?: boolean;
};
