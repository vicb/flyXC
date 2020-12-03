/* eslint-disable @typescript-eslint/no-var-requires */
const grant = require('grant').express();
import compression from 'compression';
import redisStore from 'connect-redis';
import express, { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import { Keys } from 'flyxc/common/src/keys';
import Redis from 'ioredis';
import QRCode from 'qrcode';

import { migrate } from './migrate';
import { getTrackerRouter } from './routes/live-track';
import { getStatusRouter } from './routes/status';
import { getTrackRouter } from './routes/track';
import { encode } from './waypoints';

const USE_APP_ENGINE = process.env.NODE_ENV == 'production';
const USE_SECURE_COOKIES = USE_APP_ENGINE;
const redis = new Redis(Keys.REDIS_URL);

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
      secret: Keys.SESSION_SECRET,
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
        key: Keys.GOOGLE_OAUTH_ID,
        secret: Keys.GOOGLE_OAUTH_SECRET,
        scope: ['openid', 'email', 'profile'],
        nonce: true,
        callback: '/devices.html',
        pkce: true,
      },
    }),
  );

// mount extra routes.
app.use(getStatusRouter(redis)).use(getTrackerRouter(redis)).use(getTrackRouter());

// Generates a waypoint file.
app.post('/_waypoints', (req: Request, res: Response) => {
  if (!req.body.request) {
    res.sendStatus(400);
  }
  // points elevations format prefix
  const { format, points, elevations, prefix } = JSON.parse(req.body.request);
  const { mime, file, ext, error } = encode(format, points, elevations, prefix);

  if (error) {
    res.redirect('back');
  } else {
    res.attachment(`waypoints.${ext}`).set('Content-Type', mime).send(file);
  }
});

// Generates a QR code from the given route.
app.get('/_qr.svg', async (req: Request, res: Response) => {
  if (typeof req.query.text == 'string') {
    res.set('Content-Type', 'image/svg+xml');
    res.send(await QRCode.toString(req.query.text, { type: 'svg' }));
  } else {
    res.sendStatus(500);
  }
});

// Logout.
app.get('/logout', (req: Request, res: Response) => {
  req.session?.destroy(() => null);
  res.redirect('/');
});

if (process.env.NODE_ENV != 'production') {
  app.get('/__migrate_lt', (req: Request, res: Response) => {
    migrate();
    res.sendStatus(200);
  });
}

const port = process.env.PORT || 8080;
app
  .use(express.static('frontend/static', { lastModified: false }))
  .listen(port, () => console.info(`Started server on port ${port}.`));
