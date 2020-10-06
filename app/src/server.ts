/* eslint-disable @typescript-eslint/no-var-requires */
const grant = require('grant').koa();

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import session, { SessionStore } from 'koa-generic-session';
import mount from 'koa-mount';
import redisStore from 'koa-redis';
import serve from 'koa-static';
import QRCode from 'qrcode';

import Router, { RouterContext } from '@koa/router';

import { migrate } from '../../common/migrate';
import { Keys } from './keys';
import { registerStatusRoutes } from './routes/status';
import { registerTrackerRoutes } from './routes/trackers';
import { registerTrackRoutes } from './routes/tracks';
import { encode } from './waypoints';

const app = new Koa();
app.keys = [Keys.KOA_KEY];
const router = new Router();

registerTrackRoutes(router);
registerTrackerRoutes(router);
registerStatusRoutes(router);

// Generates a waypoint file.
router.post('/_waypoints', (ctx: RouterContext): void => {
  if (!ctx.request.body.request) {
    ctx.throw(400);
  }
  // points elevations format prefix
  const { format, points, elevations, prefix } = JSON.parse(ctx.request.body.request);
  const { mime, file, ext, error } = encode(format, points, elevations, prefix);

  if (error) {
    ctx.redirect('back');
  } else {
    ctx.set('Content-Type', mime!);
    ctx.set('Content-disposition', `attachment; filename=waypoints.${ext}`);
    ctx.body = file;
  }
});

// Generates a QR code from the given route.
router.get('/_qr.svg', async (ctx: RouterContext) => {
  ctx.set('Content-Type', 'image/svg+xml');
  ctx.body = await QRCode.toString(ctx.query.text, { type: 'svg' });
});

// Logout.
router.get('/logout', async (ctx: RouterContext) => {
  ctx.session = null;
  ctx.redirect('/');
});

// @ts-ignore: always false in prod mode.
if (process.env.NODE_ENV == 'development') {
  router.get('/__migrate', async (ctx: RouterContext) => {
    await migrate();
    ctx.status = 200;
  });
}

const redisUrl = new URL(Keys.REDIS_URL);

app
  .use(
    session({
      store: (redisStore({
        host: redisUrl.hostname,
        port: Number(redisUrl.port),
        password: redisUrl.password,
      }) as unknown) as SessionStore,
      cookie: {
        // Do not set `secure: true` because of https://github.com/pillarjs/cookies#secure-cookies
        path: '/',
        httpOnly: true,
        // maxAge = null to delete the cookie when the browser is closed.
        maxAge: null,
        signed: true,
      },
    }),
  )
  .use(
    mount(
      '/oauth',
      grant({
        defaults: {
          origin: process.env.NODE_ENV == 'development' ? 'http://localhost:8080' : 'https://flyxc.app',
          prefix: '/oauth',
          transport: 'session',
          state: true,
          response: ['tokens', 'profile'],
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
    ),
  )
  .use(bodyParser({ formLimit: '32mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('frontend/static'));

const port = process.env.PORT || 8080;
app.listen(port);
