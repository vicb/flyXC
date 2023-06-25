const grant = require('grant').express(); // eslint-disable-line @typescript-eslint/no-var-requires
import { SecretKeys } from '@flyxc/common';
import { getDatastore, getRedisClient } from '@flyxc/common-node';
import compression from 'compression';
import RedisStore from 'connect-redis';
import express from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import { getAdminRouter } from './app/routes/admin';
import { getTrackerRouter } from './app/routes/live-track';
import { getTrackRouter } from './app/routes/track';
import { getWaypointRouter } from './app/routes/waypoints';
import { getZoleoRouter } from './app/routes/zoleo';
import { environment } from './environments/environment';

const redis = getRedisClient();

const datastore = getDatastore();

const app = express()
  .disable('x-powered-by')
  .use(
    compression({
      filter: (req, res) => {
        // Only compress large protocol buffers.
        // Common text types are already compressed by App Engine.
        // Protocol buffers compress to 50% of their size - ref https://stackoverflow.com/a/9199386/3252054
        const contentType = res.get('Content-Type') ?? '';
        const size = Number(res.get('Content-Length') ?? 0);
        return size > 10000 && /protobuf/i.test(contentType);
      },
    }),
  )
  .set('trust proxy', environment.gae)
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(fileUpload({ headers: { 'content-type': 'application/octet-stream' }, limits: { fileSize: 32 * 1024 * 1024 } }))
  .use(
    session({
      secret: SecretKeys.SESSION_SECRET,
      cookie: {
        httpOnly: true,
        path: '/',
        // "strict" would not send the cookie on the redirect.
        sameSite: 'lax',
        secure: environment.https,
      },
      name: 'session',
      resave: false,
      store: new RedisStore({ client: redis }),
      unset: 'destroy',
      saveUninitialized: false,
    }),
  )
  .use(
    '/oauth',
    grant({
      defaults: {
        origin: environment.origin,
        transport: 'session',
        state: true,
        response: ['tokens', 'profile'],
        prefix: '/oauth',
      },
      google: {
        key: SecretKeys.GOOGLE_OAUTH_ID,
        secret: SecretKeys.GOOGLE_OAUTH_SECRET,
        scope: ['openid', 'email', 'profile'],
        nonce: true,
        callback: '/devices.html',
        pkce: true,
        dynamic: ['callback'],
      },
    }),
  );

// mount extra routes.
app
  .use('/api/admin', getAdminRouter(redis, datastore))
  .use('/api/live', getTrackerRouter(redis, datastore))
  .use('/api/track', getTrackRouter(datastore))
  .use('/api/waypoint', getWaypointRouter())
  .use('/api/zoleo', getZoleoRouter(redis));

const port = process.env.PORT || 8080;
app.listen(port, () => console.info(`Started server on port ${port}.`));
