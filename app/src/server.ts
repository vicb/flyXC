/* eslint-disable @typescript-eslint/no-var-requires */
const grant = require('grant').express();
import compression from 'compression';
import redisStore from 'connect-redis';
import express, { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import { SecretKeys } from 'flyxc/common/src/keys';
import { getRedisClient } from 'flyxc/common/src/redis';

import { getAdminRouter } from './routes/admin';
import { getTrackerRouter } from './routes/live-track';
import { logout } from './routes/session';
import { getTrackRouter } from './routes/track';
import { encode } from './waypoints';

const USE_APP_ENGINE = process.env.NODE_ENV == 'production';
const USE_SECURE_COOKIES = USE_APP_ENGINE;
const redis = getRedisClient();

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
  .use(fileUpload({ limits: { fileSize: 32 * 1024 * 1024 } }))
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
        overrides: {
          admin: { callback: '/admin.html' },
        },
      },
    }),
  );

// mount extra routes.
app.use('/admin', getAdminRouter(redis)).use(getTrackerRouter(redis)).use(getTrackRouter());

// Generates a waypoint file.
app.post('/_waypoints', (req: Request, res: Response) => {
  if (!req.body.request) {
    res.sendStatus(400);
  }
  // points elevations format prefix
  const { format, points, prefix } = JSON.parse(req.body.request);
  const { mime, file, ext, error } = encode(format, points, prefix);

  if (error) {
    res.redirect('back');
  } else {
    res.attachment(`waypoints.${ext}`).set('Content-Type', mime).send(file);
  }
});

// Logout.
app.get('/logout', async (req: Request, res: Response) => {
  await logout(req);
  res.redirect('/');
});

const port = process.env.PORT || 8080;
app
  .use(express.static('frontend/static', { lastModified: false }))
  .listen(port, () => console.info(`Started server on port ${port}.`));
