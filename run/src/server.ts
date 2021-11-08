import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import Router, { RouterContext } from '@koa/router';

import { migrateFlyme } from './process/migrate';
import { postProcessTrack } from './process/process';

const app = new Koa();
const router = new Router();

// Post-process tracks.
router.post('/process', async (ctx: RouterContext) => {
  const body = ctx.request.body;
  if (body?.message?.data) {
    let id = '-';
    try {
      id = JSON.parse(Buffer.from(body.message.data, 'base64').toString()).id;
      console.log(`Post processing id = ${id}`);
      await postProcessTrack(id);
    } catch (e) {
      console.error(`Error processing id = ${id}`, e);
    }
  }

  ctx.status = 200;
});

if (process.env.NODE_ENV == 'development') {
  router.get('/migrate-flyme', async (ctx: RouterContext) => {
    await migrateFlyme();
    ctx.body = 'Migrated';
  });
}

app.use(bodyParser()).use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 8080;

app.listen(port);
