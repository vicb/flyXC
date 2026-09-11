import { fetchResponse, Keys, type LiveTrackEntity } from '@flyxc/common';
import type { RedisClient } from '@flyxc/common-node';
import {
  getDatastore,
  LIVE_TRACK_TABLE,
  parseMessage,
  pushListCap,
  retrieveLiveTrackByGoogleId,
  ZOLEO_MAX_MSG,
  ZOLEO_MAX_MSG_SIZE,
} from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { Request, Response } from 'express';
import { Router } from 'express';
import basicAuth from 'express-basic-auth';

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
      const { name = '', deviceId = '', enabled = true } = req.body;
      const datastore = getDatastore();
      const entity: LiveTrackEntity = await retrieveLiveTrackByGoogleId(datastore, userInfo.token);
      if (!entity) {
        return res.sendStatus(404);
      }
      entity.name = name;
      entity.updated = new Date();
      const imei = entity.zoleo?.account === deviceId ? entity.zoleo?.imei ?? '' : '';
      entity.zoleo = { account: deviceId, enabled, imei };

      await datastore.save({
        key: entity[Datastore.KEY],
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
      entity.zoleo = { account: '', imei: '', enabled: false };
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
