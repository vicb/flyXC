import { fetchResponse, Keys, round } from '@flyxc/common';
import type { RedisClient, ZoleoMessage } from '@flyxc/common-node';
import {
  getDatastore,
  LIVE_TRACK_TABLE,
  pushListCap,
  retrieveLiveTrackByGoogleId,
  ZOLEO_MAX_MESSAGE_SIZE,
  ZOLEO_MAX_MSG,
  ZOLEO_MAX_MSG_SIZE,
} from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { Request, Response } from 'express';
import { Router } from 'express';
import basicAuth from 'express-basic-auth';
import { z } from 'zod';

import { getUserInfo, isLoggedIn } from './session';

const auth = basicAuth({
  users: {
    [SECRETS.ZOLEO_PUSH_USER]: SECRETS.ZOLEO_PUSH_PWD,
  },
});

export const ZOLEO_API_URL = 'https://api.cloudconnect.zoleo.com';

const zoleoImeiMessageSchema = z
  .object({
    IMEI: z.string().min(1),
    partnerDeviceID: z.string().min(1),
  })
  .loose()
  .transform((message) => ({
    type: 'imei' as const,
    id: message.partnerDeviceID,
    imei: message.IMEI,
  }));

const zoleoLocationSchema = z
  .object({
    Latitude: z.number(),
    Longitude: z.number(),
    Speed: z.number().default(0),
    Altitude: z.number().default(0),
  })
  .loose();

const zoleoPropertiesSchema = z
  .object({
    /* The typo is from the Zoleo API, it should be "EpochMilliseconds" */
    EpochMiliseconds: z.coerce.number(),
    Battery: z.coerce.number().default(100),
  })
  .loose();

const zoleoEmailMessageSchema = z
  .object({
    MessageType: z.literal('EmailMessage'),
    DeviceIMEI: z.string().min(1),
    DeviceId: z.string().min(1),
    Message: z.string().transform((message) => message.slice(0, ZOLEO_MAX_MESSAGE_SIZE)),
    Location: z
      .object({
        Latitude: z.number().optional(),
        Longitude: z.number().optional(),
        Speed: z.number().optional().default(0),
        Altitude: z.number().optional().default(0),
      })
      .loose(),
    Properties: zoleoPropertiesSchema,
  })
  .loose();

const zoleoLocationMessageSchema = z
  .object({
    MessageType: z.string(),
    DeviceIMEI: z.string().min(1),
    DeviceId: z.string().min(1),
    Location: zoleoLocationSchema,
    Properties: zoleoPropertiesSchema,
    Message: z.string().optional(),
  })
  .loose();

export function getZoleoRouter(redis: RedisClient): Router {
  const router = Router();

  /**
   * Saves the Zoleo device ID to the user's entity in the datastore (in the account field).
   *
   * This is called by the frontend when the user consent to sharing info.
   *
   * Notes:
   * - This is different from the Zoleo link API which is not used.
   * - The devices becomes linked via a push message when users consents to sharing their info
   *   via the email link or via their zoleo account at myzoleo.com. The IMEI is populated at
   *   that point.
   */
  router.post('/link', async (req: Request, res: Response) => {
    try {
      if (!isLoggedIn(req)) {
        return res.sendStatus(403);
      }

      const userInfo = getUserInfo(req);
      if (!userInfo) {
        return res.sendStatus(500);
      }
      const { email, token } = userInfo;
      const datastore = getDatastore();
      let entity = await retrieveLiveTrackByGoogleId(datastore, token);
      if (entity == null) {
        entity = {
          email,
          google_id: token,
          created: new Date(),
          share: true,
          enabled: true,
        } as any;
      }
      const { name = '', deviceId = '', enabled = true } = req.body;
      entity.name = name;
      entity.updated = new Date();
      const imei = entity.zoleo?.account === deviceId ? entity.zoleo.imei ?? '' : '';
      entity.zoleo = { account: deviceId, enabled, imei };

      await datastore.save({
        key: entity[Datastore.KEY] ?? datastore.key([LIVE_TRACK_TABLE]),
        data: entity,
      });

      await redis.incr(Keys.fetcherCmdSyncIncCount);

      res.sendStatus(200);
    } catch (e) {
      console.error(`Error linking zoleo`, e);
      res.sendStatus(500);
    }
  });

  /**
   * Unlinks the Zoleo device from the user's account.
   *
   * This is called by the frontend when the user wants to unlink their Zoleo device.
   *
   * The entity is updated first to reflect the unlinking.
   * Then a request is sent to the Zoleo Cloud Connect unlink API.
   */
  router.post('/unlink', async (req: Request, res: Response) => {
    let deviceId: string;
    console.log('zoleo unlink', { body: req.body });
    try {
      if (!isLoggedIn(req)) {
        return res.sendStatus(403);
      }

      const userInfo = getUserInfo(req);
      if (!userInfo) {
        return res.sendStatus(500);
      }

      const datastore = getDatastore();
      const { token } = userInfo;
      const entity = await retrieveLiveTrackByGoogleId(datastore, token);
      if (!entity?.zoleo?.account) {
        return res.sendStatus(204);
      }

      // Update the entity first so that users do not have to save the form even if the zoleo API call fails below.
      deviceId = entity.zoleo.account;
      entity.updated = new Date();
      entity.zoleo.account = '';
      entity.zoleo.imei = '';
      entity.zoleo.enabled = false;
      await datastore.save({
        key: entity[Datastore.KEY],
        data: entity,
      });
      await redis.incr(Keys.fetcherCmdSyncIncCount);
    } catch (e) {
      console.error(`Failed to unlink zoleo device in datastore`, e);
      return res.sendStatus(500);
    }

    try {
      const url = `${ZOLEO_API_URL}/devices/${encodeURIComponent(deviceId)}/link`;
      const response = await fetchResponse(url, {
        method: 'DELETE',
        headers: {
          'x-api-key': SECRETS.ZOLEO_API_KEY,
        },
        timeoutS: 10,
      });
      if (!response.ok) {
        console.error(`Error unlinking zoleo device ${deviceId}: ${response.status}`);
        return res.sendStatus(502);
      }
    } catch (e) {
      console.error(`Failed to unlink zoleo device via API`, e);
      return res.sendStatus(502);
    }

    return res.sendStatus(200);
  });

  /**
   * Receives push messages from Zoleo.
   *
   * This endpoint is called by the Zoleo Data Feed whenever there is a new message for the linked devices.
   * The messages are parsed and pushed to a Redis queue to the fetcher.
   */
  router.post('/push', auth, async (req: Request, res: Response) => {
    try {
      const parsed = parseMessage(req.body);
      if (parsed != null) {
        const json = JSON.stringify(parsed);
        const pipeline = redis.multi();
        pushListCap(pipeline, Keys.zoleoMsgQueue, [json], ZOLEO_MAX_MSG, ZOLEO_MAX_MSG_SIZE);
        await pipeline.execTyped(true);
      }
    } catch (e) {
      console.error('Error processing zoleo webhook:', e);
    }
    // Always respond with 200 OK as required by Zoleo Data Feed specifications.
    res.sendStatus(200);
  });

  return router;
}

/**
 * Parses a raw Zoleo message into a structured ZoleoMessage object.
 *
 * The webhook payload has two supported shapes: a consent/registration payload and
 * a device message payload. Email messages may omit the location; the fetcher then
 * attaches them to the nearest available position.
 *
 * @see https://developers.zoleo.com/docs/guides/integration-guides-data-feed#message-types
 */
export function parseMessage(message: unknown): ZoleoMessage | null {
  const imeiParse = zoleoImeiMessageSchema.safeParse(message);
  if (imeiParse.success) {
    return imeiParse.data;
  }

  const emailParse = zoleoEmailMessageSchema.safeParse(message);
  if (emailParse.success) {
    const { DeviceId, DeviceIMEI, Location, Message, Properties } = emailParse.data;
    const parsedMessage: ZoleoMessage = {
      type: 'message',
      id: DeviceId,
      timeMs: Properties.EpochMiliseconds,
      imei: DeviceIMEI,
      batteryPercent: Properties.Battery,
      speedKph: Math.round(Location.Speed),
      altitudeM: Math.round(Location.Altitude),
      message: Message,
    };
    return parsedMessage;
  }

  const payload = zoleoLocationMessageSchema.safeParse(message);
  if (!payload.success) {
    return null;
  }

  const { MessageType, DeviceIMEI, DeviceId, Location, Properties, Message } = payload.data;
  const { Battery: batteryPercent, EpochMiliseconds: timeMs } = Properties;

  if (timeMs == null || !Number.isFinite(batteryPercent)) {
    return null;
  }

  if (Location == null) {
    return null;
  }

  const { Speed: speedKph, Altitude: altitudeM } = Location;

  const zoleoMessage: ZoleoMessage = {
    type: 'location',
    id: String(DeviceId),
    lat: round(Location.Latitude, 5),
    lon: round(Location.Longitude, 5),
    batteryPercent: round(batteryPercent, 0),
    timeMs,
    imei: String(DeviceIMEI),
    speedKph: round(speedKph, 0),
    altitudeM: round(altitudeM, 0),
    message: Message,
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
