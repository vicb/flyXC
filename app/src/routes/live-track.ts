import express, { Request, Response, Router } from 'express';
import { LiveDifferentialTrackGroup } from 'flyxc/common/protos/live-track';
import { Keys } from 'flyxc/common/src/keys';
import { INCREMENTAL_UPDATE_SEC } from 'flyxc/common/src/live-track';
import { LIVE_TRACK_TABLE, LiveTrackEntity, UpdateLiveTrackEntityFromModel } from 'flyxc/common/src/live-track-entity';
import { AccountFormModel, AccountModel } from 'flyxc/common/src/models';
import { getFlyMeId } from 'flyxc/run/src/trackers/flyme';
import Redis from 'ioredis';

/* eslint-disable @typescript-eslint/no-var-requires */
import { Datastore } from '@google-cloud/datastore';
import { NoDomBinder } from '@vaadin/form/NoDomBinder';

const datastore = new Datastore();

// Interface for session.grant.response.
interface GrantSession {
  access_token?: string;
  // The profile should only be accessed when the access token is defined.
  profile: {
    name: string;
    email: string;
    sub: string;
  };
}

function getGrantSession(req: Request): GrantSession | undefined {
  const session = req.session as any;
  return session?.grant?.response;
}

export function getTrackerRouter(redis: Redis.Redis): Router {
  const router = express.Router();

  // Get the geojson for the currently active trackers.
  router.get('/_livetracks', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    await redis.set('trackers.request', Date.now());
    const token = req.header('token');
    if (!token) {
      const time = req.query.s ?? 0;
      const incrementalAfter = Date.now() / 1000 - INCREMENTAL_UPDATE_SEC + 60;
      const key = time > incrementalAfter ? 'trackers.inc.proto' : 'trackers.proto';
      res.set('Content-Type', 'application/x-protobuf');
      res.send(await redis.getBuffer(key));
    } else {
      switch (token) {
        case Keys.FLYME_TOKEN:
          const groupProto = await redis.getBuffer('trackers.flyme.proto');
          if (req.header('accept') == 'application/json') {
            const track = LiveDifferentialTrackGroup.fromBinary(groupProto);
            res.json(LiveDifferentialTrackGroup.toJson(track));
          } else {
            res.set('Content-Type', 'application/x-protobuf');
            res.send(groupProto);
          }
          break;
        default:
          res.sendStatus(400);
      }
    }
  });

  // Get the account information.
  router.get('/_account', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const session = getGrantSession(req);
    if (!session || session.access_token == null) {
      res.sendStatus(403);
      return;
    }

    try {
      const { name, sub } = session.profile;
      let account: AccountModel;
      const [entities] = await datastore.createQuery(LIVE_TRACK_TABLE).filter('google_id', sub).limit(1).run();

      if (entities.length == 0) {
        account = AccountFormModel.createEmptyValue();
        account.name = name;
      } else {
        // TODO: erase the current track on update ?
        const entity = entities[0] as LiveTrackEntity;
        account = AccountFormModel.createFromEntity(entity);
      }

      res.json(account);
    } catch (e) {
      res.sendStatus(400);
    }
  });

  // Updates the tracker information.
  router.post('/_account', async (req: Request, res: Response) => {
    const session = getGrantSession(req);
    if (!session || session.access_token == null) {
      res.sendStatus(403);
      return;
    }

    try {
      const account: AccountModel = req.body;

      const binder = new NoDomBinder(AccountFormModel);
      binder.read(account);

      const model = binder.model;
      binder.for(model.flyme.account).addValidator({
        message: 'This FlyMe username is invalid.',
        validate: async (username: string) => {
          try {
            const id = await getFlyMeId(username);
            if (id === undefined) {
              return false;
            }
          } catch (e) {}
          return true;
        },
      });

      const validationErrorData = (await binder.validate()).map(({ property, message }) => ({
        parameterName: property,
        message,
      }));

      if (validationErrorData.length) {
        res.json({
          error: `The form contains invalid values!`,
          validationErrorData,
        });
        return;
      }

      const { email, sub } = session.profile;
      const [entities] = await datastore.createQuery(LIVE_TRACK_TABLE).filter('google_id', sub).limit(1).run();

      const entity = UpdateLiveTrackEntityFromModel(entities[0], account, email, sub);

      try {
        await datastore.save({
          key: entity[Datastore.KEY] ?? datastore.key([LIVE_TRACK_TABLE]),
          data: entity,
          excludeFromIndexes: ['track'],
        });
      } catch (e) {
        console.error(`Error saving the account ${email}`);
        res.json({ error: `An error has occurred, please try again later.` });
        return;
      }

      // Sign out the user.
      req.session.destroy(() => null);
      res.json({ error: false });
    } catch (e) {
      console.error(`Error updating an account: ${e}`);
      res.sendStatus(400);
    }
  });

  return router;
}
