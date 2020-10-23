/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
import express, { Request, Response, Router } from 'express';
import Redis from 'ioredis';

const datastore = new Datastore();

export function getTrackerRouter(redis: Redis.Redis): Router {
  const router = express.Router();

  // Get the geojson for the currently active trackers.
  router.get('/_trackers.geojson', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    await redis.set('trackers.request', Date.now());
    res.send(await redis.get('trackers.geojson'));
  });

  // Get the tracker information if the users is signed id.
  router.get('/_tracker', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (req.session?.grant?.response?.access_token == null) {
      res.json({ signedIn: false });
      return;
    }

    try {
      const { name, email, sub } = req.session?.grant?.response?.profile;
      const key = datastore.key(['Tracker', sub]);
      let tracker = (await datastore.get(key))[0];
      if (!tracker) {
        tracker = {
          created: new Date(),
          updated: 0,
          device: 'no',
          inreach: '',
          spot: '',
          skylines: '',
          email,
          name,
        };
        await datastore.save({
          key,
          data: tracker,
        });
      }
      res.json({
        signedIn: true,
        name,
        device: tracker.device,
        inreach: tracker.inreach,
        spot: tracker.spot,
        skylines: tracker.skylines,
      });
    } catch (e) {
      res.sendStatus(400);
    }
  });

  // Updates the tracker information.
  router.post('/_tracker', async (req: Request, res: Response) => {
    try {
      if (req.session?.grant?.response?.access_token == null) {
        res.sendStatus(400);
        return;
      }

      const key = datastore.key(['Tracker', req.session?.grant?.response?.profile?.sub]);
      const tracker = (await datastore.get(key))[0];
      if (tracker) {
        ['device', 'inreach', 'spot', 'skylines'].forEach((k) => {
          tracker[k] = req.body[k];
        });
        tracker.updated = 0;
        await datastore.save({
          key,
          data: tracker,
          excludeFromIndexes: ['features'],
        });
      }
      res.json({ error: false });
      // sign the user out
      req.session.destroy(() => null);
    } catch (e) {
      res.sendStatus(400);
    }
  });

  return router;
}
