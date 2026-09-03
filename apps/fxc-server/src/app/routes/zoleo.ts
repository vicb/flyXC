import { fetchResponse, Keys, round } from '@flyxc/common';
import type { RedisClient, ZoleoMessage } from '@flyxc/common-node';
import {
  getDatastore,
  LIVE_TRACK_TABLE,
  pushListCap,
  retrieveLiveTrackByGoogleId,
  ZOLEO_MAX_MSG,
  ZOLEO_MAX_MSG_SIZE,
} from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { Request, Response } from 'express';
import { Router } from 'express';
import basicAuth from 'express-basic-auth';
import { pathGet } from 'object-standard-path';

import { getUserInfo, isLoggedIn } from './session';

const auth = basicAuth({
  users: {
    [SECRETS.ZOLEO_PUSH_USER]: SECRETS.ZOLEO_PUSH_PWD,
  },
});

export const ZOLEO_API_URL = 'https://api.cloudconnect.zoleo.com';

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
 * @see https://developers.zoleo.com/docs/guides/integration-guides-data-feed#message-types
 */
export function parseMessage(message: any): ZoleoMessage | null {
  if (message == null || typeof message !== 'object') {
    return null;
  }

  // Handle consent approval notification / device registration.
  if ('IMEI' in message) {
    if (message.IMEI && message.partnerDeviceID) {
      return {
        type: 'imei',
        id: message.partnerDeviceID,
        imei: String(message.IMEI),
      };
    } else {
      return null;
    }
  }

  const lat = pathGet(message, 'Location.Latitude');
  const lon = pathGet(message, 'Location.Longitude');
  const speedKph = pathGet(message, 'Location.Speed') ?? 0;
  const altitudeM = pathGet(message, 'Location.Altitude') ?? 0;
  const imei = message.DeviceIMEI;
  const id = message.DeviceId;
  const timeMs = pathGet(message, 'Properties.EpochMiliseconds');
  const batteryPercent = Number(pathGet(message, 'Properties.Battery') ?? 100);

  if (lat == null || lon == null || timeMs == null || imei == null || id == null) {
    return null;
  }

  const zoleoMessage: ZoleoMessage = {
    type: 'msg',
    id: String(id),
    lat: round(lat, 5),
    lon: round(lon, 5),
    speedKph: round(speedKph, 0),
    altitudeM: round(altitudeM, 0),
    batteryPercent: round(batteryPercent, 0),
    timeMs: Number(timeMs),
    imei: String(imei),
  };

  switch (message.MessageType) {
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
    case 'EmailMessage':
    case 'AppMessage':
      // Informational messaging, return null for live tracking
      return null;
    default:
      console.warn(`Ignored unknown zoleo message type: ${message.MessageType}`);
      return null;
  }

  return zoleoMessage;
}
