import { round } from '@flyxc/common';
import { z } from 'zod';

// Max size of a single ZOLEO message in bytes
export const ZOLEO_MAX_MSG_SIZE = 250;
// Max size of a single ZOLEO email message in bytes (message field)
export const ZOLEO_MAX_MESSAGE_SIZE = 200;

// Consume at max 1MB of memory
export const ZOLEO_MAX_MSG = Math.floor((1_024 * 1024) / ZOLEO_MAX_MSG_SIZE);

type ZoleoCommon = {
  timeMs: number;
  imei: string;
  batteryPercent: number;
};

/** Check-in message, location start/update/stop. */
type ZoleoLocationMessage = ZoleoCommon & {
  type: 'location';
  lat: number;
  lon: number;
  altitudeM: number;
  // default to false
  emergency?: boolean;
  message?: string;
};

/** Email message. */
type ZoleoTextMessage = ZoleoCommon & {
  type: 'message';
  lat?: number;
  lon?: number;
  altitudeM?: number;
  message: string;
};

export type ZoleoMessage =
  | ZoleoLocationMessage
  | ZoleoTextMessage
  /** Message sent when user consents to data sharing (via email link or myzoleo.com) */
  | {
      type: 'imei';
      device_id: string;
      imei: string;
    };

const zoleoImeiMessageSchema = z
  .object({
    IMEI: z.string().min(1),
    partnerDeviceID: z.string().min(1),
  })
  .loose()
  .transform((message) => ({
    type: 'imei' as const,
    device_id: message.partnerDeviceID,
    imei: message.IMEI,
  }));

const coordSchema = z.number().transform((value) => round(value, 5));
const roundIntSchema = (defaultValue = 0) => z.coerce.number().default(defaultValue).transform(Math.round);

const zoleoLocationSchema = z
  .object({
    Latitude: coordSchema,
    Longitude: coordSchema,
    Altitude: roundIntSchema(0),
  })
  .loose();

const zoleoPropertiesSchema = z
  .object({
    // The typo is from the Zoleo API, it should be "EpochMilliseconds".
    EpochMiliseconds: z.coerce.number(),
    Battery: roundIntSchema(100),
  })
  .loose();

const zoleoEmailMessageSchema = z
  .object({
    MessageType: z.literal('EmailMessage'),
    DeviceIMEI: z.string().min(1),
    Message: z.string().transform((message) => message.slice(0, ZOLEO_MAX_MESSAGE_SIZE)),
    Location: z
      .object({
        Latitude: coordSchema.optional(),
        Longitude: coordSchema.optional(),
        Altitude: roundIntSchema(0).optional(),
      })
      .loose(),
    Properties: zoleoPropertiesSchema,
  })
  .loose();

const zoleoLocationMessageSchema = z
  .object({
    MessageType: z.string(),
    DeviceIMEI: z.string().min(1),
    Location: zoleoLocationSchema,
    Properties: zoleoPropertiesSchema,
  })
  .loose();

/**
 * Parses a raw Zoleo webhook payload into a queueable message.
 *
 * @param message Raw Zoleo webhook payload.
 * @returns Parsed Zoleo message, or null when the payload is invalid or unsupported.
 */
export function parseMessage(message: unknown): ZoleoMessage | null {
  const imeiParse = zoleoImeiMessageSchema.safeParse(message);
  if (imeiParse.success) {
    return imeiParse.data;
  }

  const emailParse = zoleoEmailMessageSchema.safeParse(message);
  if (emailParse.success) {
    const { DeviceIMEI, Location, Message, Properties } = emailParse.data;
    const parsedMessage: ZoleoMessage = {
      type: 'message',
      imei: DeviceIMEI,
      timeMs: Properties.EpochMiliseconds,
      batteryPercent: Properties.Battery,
      message: Message,
    };
    if (Location.Latitude != null && Location.Longitude != null) {
      parsedMessage.lat = Location.Latitude;
      parsedMessage.lon = Location.Longitude;
      parsedMessage.altitudeM = Location.Altitude;
    }
    return parsedMessage;
  }

  const payload = zoleoLocationMessageSchema.safeParse(message);
  if (!payload.success) {
    return null;
  }

  const { MessageType, DeviceIMEI, Location, Properties } = payload.data;
  const zoleoMessage: ZoleoMessage = {
    type: 'location',
    lat: Location.Latitude,
    lon: Location.Longitude,
    batteryPercent: Properties.Battery,
    timeMs: Properties.EpochMiliseconds,
    imei: DeviceIMEI,
    altitudeM: Location.Altitude,
  };

  switch (MessageType) {
    case 'CheckIn':
      zoleoMessage.message = 'Check-In';
      break;
    case 'LS_start':
    case 'LS_location':
    case 'LS_end':
    case 'PingLocation':
      break;
    case 'SOSInitiated':
      zoleoMessage.message = 'SOS';
      zoleoMessage.emergency = true;
      break;
    case 'SOSCancelled':
      zoleoMessage.message = 'SOS Cancelled';
      zoleoMessage.emergency = false;
      break;
    default:
      console.warn(`Ignored unknown zoleo message type: ${MessageType}`);
      return null;
  }

  return zoleoMessage;
}
