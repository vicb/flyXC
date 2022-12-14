/* eslint-disable @typescript-eslint/no-var-requires */
const grant = require('grant').express();
import compression from 'compression';
import redisStore from 'connect-redis';
import express, { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import { SecretKeys } from 'flyxc/common/src/keys';
import { getRedisClient } from 'flyxc/common/src/redis';
import path from 'path';

import { getAdminRouter } from './routes/admin';
import { getTrackerRouter } from './routes/live-track';
import { getTrackRouter } from './routes/track';
import { getWaypointRouter } from './routes/waypoints';

const USE_APP_ENGINE = process.env.NODE_ENV == 'production';
const USE_SECURE_COOKIES = USE_APP_ENGINE;
const redis = getRedisClient();

// Old route -> new route
const redirects = {
  get: {
    '/_livetracks': '/live/tracks.pbf',
    '/_account': '/live/account.json',
    '/logout': '/live/logout',
    '/_download': '/track/byurl.pbf',
    '/_history': '/track/byid.pbf',
    '/_archives': '/track/archives.pbf',
    '/_metadata': '/track/metadata.pbf',
    '/_airspaces': '/track/airspaces.json',
  },
  post: {
    '/_account': '/live/account.json',
    '/_upload': '/track/upload.pbf',
    '/_waypoints': `/waypoint/download`,
  },
};

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
  .set('trust proxy', USE_APP_ENGINE)
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
        secure: USE_SECURE_COOKIES,
      },
      name: 'session',
      resave: false,
      store: new (redisStore(session))({ client: redis }),
      unset: 'destroy',
      saveUninitialized: false,
    }),
  )
  .use(
    '/oauth',
    grant({
      defaults: {
        origin: process.env.NODE_ENV == 'development' ? 'http://localhost:8080' : 'https://flyxc.app',
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

// redirects
for (const [from, to] of Object.entries(redirects.get)) {
  app.get(from, (req: Request, res: Response) => {
    const index = req.originalUrl.indexOf('?');
    const search = index > -1 ? req.originalUrl.substring(index) : ``;
    res.redirect(301, `${to}${search}`);
  });
}
for (const [from, to] of Object.entries(redirects.post)) {
  app.post(from, (req: Request, res: Response) => {
    const index = req.originalUrl.indexOf('?');
    const search = index > -1 ? req.originalUrl.substring(index) : ``;
    res.redirect(308, `${to}${search}`);
  });
}

// mount extra routes.
app
  .use('/admin', getAdminRouter(redis))
  .use('/live', getTrackerRouter(redis))
  .use('/track', getTrackRouter())
  .use('/waypoint', getWaypointRouter());

const port = process.env.PORT || 8080;
app
  .use(express.static('frontend/static', { lastModified: false }))
  .get('*', (req: Request, res: Response) => {
    res.type('html').sendFile(path.join(__dirname, '../frontend/static', 'index.html'));
  })
  .listen(port, () => console.info(`Started server on port ${port}.`));
