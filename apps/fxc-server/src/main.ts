import { getDatastore, getRedisClient } from '@flyxc/common-node';
import compression from 'compression';
import { RedisStore } from 'connect-redis';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import grant from 'grant';

import { config } from './app/config';
import { getAdminRouter } from './app/routes/admin';
import { getTrackerRouter } from './app/routes/live-track';
import { getMeshBirRouter } from './app/routes/meshbir';
import { getTrackRouter } from './app/routes/track';
import { getWaypointRouter } from './app/routes/waypoints';
import { getZoleoRouter } from './app/routes/zoleo';

const grantExpress = grant.express();

const redis = getRedisClient(SECRETS.REDIS_URL);

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
    }) as unknown as RequestHandler,
  )
  // Enable pre-flight
  .use(
    cors({
      origin: corsDelegate,
      credentials: true,
      exposedHeaders: ['xsrf-token'],
    }),
  )
  .set('trust proxy', config.gae)
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(
    fileUpload({
      headers: { 'content-type': 'application/octet-stream' },
      limits: { fileSize: 32 * 1024 * 1024 },
    }) as unknown as RequestHandler,
  )
  .use(
    session({
      secret: SECRETS.SESSION_SECRET,
      cookie: {
        httpOnly: true,
        path: '/',
        // "strict" would not send the cookie on the redirect.
        sameSite: 'lax',
        domain: config.cookieDomain,
        secure: config.https,
      },
      name: config.cookieName,
      resave: false,
      store: new RedisStore({ client: redis }),
      unset: 'destroy',
      saveUninitialized: false,
    }) as unknown as RequestHandler,
  )
  .use(
    '/oauth',
    grantExpress({
      defaults: {
        origin: config.oauthOrigin,
        transport: 'session',
        state: true,
        response: ['tokens', 'profile'],
        prefix: '/oauth',
      },
      google: {
        key: SECRETS.GOOGLE_OAUTH_ID,
        secret: SECRETS.GOOGLE_OAUTH_SECRET,
        scope: ['openid', 'email', 'profile'],
        nonce: true,
        callback: '/devices.html',
        pkce: true,
        dynamic: ['callback'],
      },
    }),
  )
  .use('/api/admin', getAdminRouter(redis, datastore))
  .use('/api/live', getTrackerRouter(redis, datastore))
  .use('/api/track', getTrackRouter(datastore))
  .use('/api/waypoint', getWaypointRouter())
  .use('/api/zoleo', getZoleoRouter(redis))
  .use('/api/bircom', getMeshBirRouter(redis));

const port = process.env.PORT || 8080;
app.listen(port, () => console.info(`Started server on port ${port}.`));

type originCallback = (error: any, origin: any) => void;

// Allow only whitelisted domains
function corsDelegate(requestOrigin: string | undefined, callback: originCallback): void {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (requestOrigin == null) {
    callback(null, { origin: true });
    return;
  }

  try {
    const { hostname } = new URL(requestOrigin);
    const origin: boolean = config.corsAllowList.some((allowedDomain) => {
      if (allowedDomain.startsWith('.')) {
        return hostname.endsWith(allowedDomain);
      }
      return hostname === allowedDomain;
    });
    callback(null, { origin });
  } catch (e) {
    console.error('CORS error', e);
  }
}
