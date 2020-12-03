import { UpdateLiveTrackEntityFromModel } from 'flyxc/common/src/live-track-entity';
import {
  AccountModel,
  validateInreachAccount,
  validateSkylinesAccount,
  validateSpotAccount,
} from 'flyxc/common/src/models';

import { Datastore } from '@google-cloud/datastore';

const datastore = new Datastore();

export async function migrate(): Promise<void> {
  let [entities, info] = await datastore.createQuery('Tracker').limit(50).run();

  const numDevices = {
    inreach: 0,
    spot: 0,
    skylines: 0,
    total: 0,
  };

  const trackers: any[] = [];

  while (true) {
    entities.forEach((entity) => {
      numDevices.total++;
      switch (entity.device) {
        case 'inreach':
          numDevices.inreach++;
          if (validateInreachAccount(entity.inreach) === false) {
            console.error(`Invalid Inreach "${entity.inreach}" (${entity.email})`);
          } else {
            trackers.push(createTracker(entity, { inreach: { enabled: true, account: entity.inreach } }));
          }
          break;
        case 'spot':
          numDevices.spot++;
          if (validateSpotAccount(entity.spot) === false) {
            console.error(`Invalid Inreach "${entity.spot}" (${entity.email})`);
          } else {
            trackers.push(createTracker(entity, { spot: { enabled: true, account: entity.spot } }));
          }
          break;
        case 'skylines':
          numDevices.skylines++;
          if (validateSkylinesAccount(entity.skylines) === false) {
            console.error(`Invalid Inreach "${entity.skylines}" (${entity.email})`);
          } else {
            trackers.push(createTracker(entity, { skylines: { enabled: true, account: entity.skylines } }));
          }
          break;
      }
    });

    if (info.moreResults == Datastore.NO_MORE_RESULTS) {
      break;
    } else {
      [entities, info] = await datastore
        .createQuery('Tracker')
        .start(info.endCursor as string)
        .limit(50)
        .run();
    }
  }

  // await datastore.save(
  //   trackers.map((data) => ({
  //     key: datastore.key('LiveTrack'),
  //     data,
  //   })),
  // );

  console.log(numDevices);
}

function createTracker(entity: any, props: any) {
  const account: AccountModel = {
    name: entity.name,
    enabled: true,
    share: true,
    inreach: { account: '', enabled: false },
    spot: { account: '', enabled: false },
    skylines: { account: '', enabled: false },
    flyme: { account: '', enabled: false },
    ...props,
  };

  const tracker = UpdateLiveTrackEntityFromModel(undefined, account, entity.email, entity[Datastore.KEY].name);
  tracker.created = entity.created;
  return tracker;
}
