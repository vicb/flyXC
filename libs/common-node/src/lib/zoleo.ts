export const ZOLEO_MAX_MSG_SIZE = 250;
// Consume at max 1MB of memory
export const ZOLEO_MAX_MSG = Math.floor(1e6 / ZOLEO_MAX_MSG_SIZE);

export type ZoleoMessage =
  | {
      type: 'msg';
      lat: number;
      lon: number;
      speedKph: number;
      altitudeM: number;
      batteryPercent: number;
      timeMs: number;
      imei: string;
      // default to false
      emergency?: boolean;
      message?: string;
    }
  | {
      type: 'imei';
      id: string;
      imei: string;
    };
