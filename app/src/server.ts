import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import QRCode from 'qrcode';

import Router, { RouterContext } from '@koa/router';

import { migrate } from '../../common/migrate';
import { registerStatusRoutes } from './routes/status';
import { registerTrackerRoutes } from './routes/trackers';
import { registerTrackRoutes } from './routes/tracks';
import { encode } from './waypoints';

const app = new Koa();
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

// @ts-ignore: always false in prod mode.
if (process.env.NODE_ENV == 'development') {
  router.get('/__migrate', async (ctx: RouterContext) => {
    await migrate();
    ctx.status = 200;
  });
}

app
  .use(bodyParser({ formLimit: '32mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('frontend/static'));

const port = process.env.PORT || 8080;
app.listen(port);
