import csurf from '@dr.pogodin/csurf';
import {
  AccountFormModel,
  AccountModel,
  INCREMENTAL_UPDATE_SEC,
  Keys,
  LiveTrackEntity,
  protos,
  SecretKeys,
} from '@flyxc/common';
import {
  FlyMeValidator,
  InreachValidator,
  LIVE_TRACK_TABLE,
  retrieveLiveTrackByGoogleId,
  SkylinesValidator,
  updateLiveTrackEntityFromModel,
} from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import { NoDomBinder } from '@vaadin/nodom';
import { Request, Response, Router } from 'express';
import { Redis } from 'ioredis';
import { getUserInfo, isLoggedIn, logout } from './session';

// Store the token in the session.
const csrfProtection = csurf({ cookie: false });

export function getTrackerRouter(redis: Redis, datastore: Datastore): Router {
  const router = Router();

  // Get the geojson for the currently active trackers.
  router.get('/tracks.pbf', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const token = req.header('token');
    if (!token) {
      // Pick the incremental proto if last request was recent.
      const timeSec = Number(req.query.s ?? 0);
      const incrementalAfter = Date.now() / 1000 - INCREMENTAL_UPDATE_SEC + 60;
      const key = timeSec > incrementalAfter ? Keys.fetcherIncrementalProto : Keys.fetcherFullProto;
      res.set('Content-Type', 'application/x-protobuf');
      res.send(await redis.getBuffer(key));
    } else {
      switch (token) {
        case SecretKeys.FLYME_TOKEN: {
          const groupProto = await redis.getBuffer(Keys.fetcherExportFlymeProto);
          if (req.header('accept') == 'application/json') {
            const track = protos.LiveDifferentialTrackGroup.fromBinary(groupProto!);
            res.json(protos.LiveDifferentialTrackGroup.toJson(track));
          } else {
            res.set('Content-Type', 'application/x-protobuf');
            res.send(groupProto);
          }
          break;
        }
        default:
          res.sendStatus(400);
      }
    }
  });

  // Get the account information.
  router.get('/account.json', csrfProtection, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (!isLoggedIn(req)) {
      res.sendStatus(403);
      return;
    }

    try {
      const userInfo = getUserInfo(req);
      if (!userInfo) {
        res.sendStatus(500);
        return;
      }

      const { name, token } = userInfo;
      let account: AccountModel;
      const entity = await retrieveLiveTrackByGoogleId(datastore, token);

      if (!entity) {
        account = AccountFormModel.createEmptyValue();
        account.name = name;
      } else {
        account = AccountFormModel.createFromEntity(entity);
      }

      res.set('xsrf-token', (req as any).csrfToken());
      res.json(account);
    } catch (e) {
      res.sendStatus(400);
    }
  });

  // Updates the tracker information.
  router.post('/account.json', csrfProtection, async (req: Request, res: Response) => {
    if (!isLoggedIn(req)) {
      return res.sendStatus(403);
    }

    const userInfo = getUserInfo(req);
    if (!userInfo) {
      return res.sendStatus(500);
    }
    const { email, token } = userInfo;
    const entity = await retrieveLiveTrackByGoogleId(datastore, token);
    return createOrUpdateLiveTrack(datastore, entity, req, res, email, token, redis);
  });

  // Logout.
  router.get('/logout', async (req: Request, res: Response) => {
    await logout(req);
    res.redirect('/');
  });

  return router;
}

// Create or update a LiveTrack entity from the form POST data.
export async function createOrUpdateLiveTrack(
  datastore: Datastore,
  entity: LiveTrackEntity | undefined,
  req: Request,
  res: Response,
  email: string,
  token: string,
  redis: Redis,
) {
  try {
    const account: AccountModel = req.body;
    const binder = new NoDomBinder(AccountFormModel);
    binder.read(account);

    // Server side validators.
    const model = binder.model;
    binder.for(model.flyme).addValidator(new FlyMeValidator(entity?.flyme));
    binder.for(model.inreach).addValidator(new InreachValidator(entity?.inreach));
    binder.for(model.skylines).addValidator(new SkylinesValidator(entity?.skylines));

    // Sends error to the client.
    const validationErrorData = (await binder.validate()).map(({ property, message }) => ({
      parameterName: property,
      message,
    }));

    if (validationErrorData.length) {
      return res.json({
        error: `The form contains invalid values!`,
        validationErrorData,
      });
    }

    entity = updateLiveTrackEntityFromModel(entity, account, email, token);

    try {
      await datastore.save({
        key: entity[Datastore.KEY] ?? datastore.key([LIVE_TRACK_TABLE]),
        data: entity,
      });
      // Sends a command to the fetcher to sync from the DB.
      await redis.incr(Keys.fetcherCmdSyncIncCount);
      return res.json({ error: false });
    } catch (e) {
      console.error(`Error saving the account ${email}`);
      return res.json({ error: `An error has occurred, please try again later.` });
    }
  } catch (e) {
    console.error(`Error updating an account: ${e}`);
    return res.sendStatus(400);
  }
}
