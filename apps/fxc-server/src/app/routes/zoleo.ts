import { fetchResponse, Keys, round, SecretKeys } from '@flyxc/common';
import type { ZoleoMessage } from '@flyxc/common-node';
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
import type Redis from 'ioredis';
import { pathGet } from 'object-standard-path';

import { getUserInfo, isLoggedIn } from './session';

const auth = basicAuth({
  users: {
    [SecretKeys.ZOLEO_PUSH_USER]: SecretKeys.ZOLEO_PUSH_PWD,
  },
});

export function getZoleoRouter(redis: Redis): Router {
  const router = Router();

  // Update the entity when a zoleo is linked.
  // So that users do not have to save the form.
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
      const { name = '', account = '', enabled = true } = req.body;
      entity.name = name;
      entity.updated = new Date();
      entity.zoleo = { account, enabled, imei: '' };

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

  // Unlink:
  // - update the entity so that users do not have to save the form,
  // - send an unlink request to zoleo.
  router.post('/unlink', async (req: Request, res: Response) => {
    let status = 200;
    let deviceId: string;
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

      if (entity.zoleo) {
        entity.updated = new Date();
        deviceId = entity.zoleo.account;
        entity.zoleo.account = '';
        entity.zoleo.imei = '';
        await datastore.save({
          key: entity[Datastore.KEY],
          data: entity,
        });
        await redis.incr(Keys.fetcherCmdSyncIncCount);
      }
    } catch (e) {
      console.error(`Error unlink zoleo`, e);
      status = 500;
    }

    try {
      const url = SecretKeys.ZOLEO_UNLINK_URL.replace('{deviceId}', deviceId);
      const response = await fetchResponse(url, {
        method: 'PUT',
        headers: {
          'x-api-key': SecretKeys.ZOLEO_UNLINK_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inactive' }),
      });
      if (!response.ok || (await response.json()).statusCode != 200) {
        status = 500;
        console.error(`Error unlinking zoleo`);
      }
    } catch (e) {
      console.error(`Error unlinking zoleo`, e);
      status = 500;
    }

    res.sendStatus(status);
  });

  // Hook called by zoleo.
  router.post('/push', auth, async (req: Request, res: Response) => {
    try {
      const json = JSON.stringify(parseMessage(req.body));
      if (json != null) {
        const pipeline = redis.pipeline();
        pushListCap(pipeline, Keys.zoleoMsgQueue, [json], ZOLEO_MAX_MSG, ZOLEO_MAX_MSG_SIZE);
        await pipeline.exec();
      }
      res.sendStatus(200);
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  return router;
}

// Parses zoleo message in a lighter format.
export function parseMessage(message: any): ZoleoMessage | null {
  if ('IMEI' in message) {
    if (message.IMEI && message.partnerDeviceID) {
      return {
        type: 'imei',
        id: message.partnerDeviceID,
        imei: message.IMEI,
      };
    } else {
      throw new Error(`Invalid IMEI message`);
    }
  }

  const lat = pathGet(message, 'Location.Latitude');
  const lon = pathGet(message, 'Location.Longitude');
  const speedKph = pathGet(message, 'Location.Speed') ?? 0;
  const altitudeM = pathGet(message, 'Location.Altitude') ?? 0;
  const imei = message.DeviceIMEI;
  const timeMs = pathGet(message, 'Properties.EpochMiliseconds');
  const batteryPercent = Number(pathGet(message, 'Properties.Battery') ?? 100);

  if (lat == null || lon == null || timeMs == null || imei == null) {
    return null;
  }

  const zoleMessage: ZoleoMessage = {
    type: 'msg',
    lat: round(lat, 5),
    lon: round(lon, 5),
    speedKph: round(speedKph, 0),
    altitudeM: round(altitudeM, 0),
    batteryPercent: round(batteryPercent, 0),
    timeMs: Number(timeMs),
    imei,
  };

  switch (message.MessageType) {
    case 'CheckIn':
      zoleMessage.message = 'Check-In';
      break;
    case 'LS_start':
    case 'LS_location':
    case 'LS_end':
      break;
    case 'SOSInitiated':
      zoleMessage.message = 'SOS';
      zoleMessage.emergency = true;
      break;
    default:
      throw new Error(`Unsupported message type (${message.MessageType})`);
  }

  return zoleMessage;
}
