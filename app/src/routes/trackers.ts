/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
const { OAuth2Client } = require('google-auth-library');
/* eslint-enable @typescript-eslint/no-var-requires */

import Redis from 'ioredis';

import Router, { RouterContext } from '@koa/router';

import { Keys } from '../keys';

const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

export function registerTrackerRoutes(router: Router): void {
  // Get the geojson for the currently active trackers.
  router.get(
    '/_trackers.geojson',
    async (ctx: RouterContext): Promise<void> => {
      await redis.set('trackers.request', Date.now());
      ctx.body = await redis.get('trackers.geojson');
    },
  );

  // SignIn when adding/updating a tracker.
  router.post(
    '/_tokenSignIn',
    async (ctx: RouterContext): Promise<void> => {
      try {
        const userId = await getUserId(ctx.request.body.token);
        const key = datastore.key(['Tracker', userId]);
        let tracker = (await datastore.get(key))[0];
        if (!tracker) {
          tracker = {
            created: new Date(),
            updated: 0,
            device: 'no',
            inreach: '',
            spot: '',
            email: ctx.request.body.email,
            name: ctx.request.body.name,
          };
          await datastore.save({
            key,
            data: tracker,
          });
        }
        ctx.set('Content-Type', 'application/json');
        ctx.body = JSON.stringify({
          device: tracker.device,
          inreach: tracker.inreach,
          spot: tracker.spot,
        });
      } catch (e) {
        ctx.throw(400);
      }
    },
  );

  // Updates the tracker information.
  router.post(
    '/_updateTracker',
    async (ctx: RouterContext): Promise<void> => {
      try {
        const userId = await getUserId(ctx.request.body.token);
        const key = datastore.key(['Tracker', userId]);
        const tracker = (await datastore.get(key))[0];
        if (tracker) {
          tracker.device = ctx.request.body.device;
          tracker.inreach = ctx.request.body.inreach;
          tracker.spot = ctx.request.body.spot;
          tracker.updated = 0;
          await datastore.save({
            key,
            data: tracker,
            excludeFromIndexes: ['features'],
          });
        }
        ctx.set('Content-Type', 'application/json');
        ctx.body = JSON.stringify({
          device: tracker.device,
          inreach: tracker.inreach,
          spot: tracker.spot,
        });
      } catch (e) {
        ctx.throw(400);
      }
    },
  );

  async function getUserId(idToken: string): Promise<string> {
    const CLIENT_ID = '754556983658-qscerk4tpsu8mgb1kfcq5gvf8hmqsamn.apps.googleusercontent.com';
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload['sub'];
  }
}
