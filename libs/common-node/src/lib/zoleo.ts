// Max size of a single ZOLEO message in bytes
export const ZOLEO_MAX_MSG_SIZE = 250;
// Max size of a single ZOLEO email message in bytes (message field)
export const ZOLEO_MAX_MESSAGE_SIZE = 200;

// Consume at max 1MB of memory
export const ZOLEO_MAX_MSG = Math.floor((1_024 * 1024) / ZOLEO_MAX_MSG_SIZE);

type ZoleoCommon = {
  id: string;
  timeMs: number;
  imei: string;
  batteryPercent: number;
  speedKph: number;
  altitudeM: number;
};

/** Check-in message, location start/update/stop. */
type ZoleoLocationMessage = ZoleoCommon & {
  type: 'location';
  lat: number;
  lon: number;
  // default to false
  emergency?: boolean;
  message?: string;
};

/** Email message. */
type ZoleoTextMessage = ZoleoCommon & {
  type: 'message';
  lat?: number;
  lon?: number;
  message: string;
};

export type ZoleoMessage =
  | ZoleoLocationMessage
  | ZoleoTextMessage
  /** Message sent when user consents to data sharing (via email link or myzoleo.com) */
  | {
      type: 'imei';
      id: string;
      imei: string;
    };
