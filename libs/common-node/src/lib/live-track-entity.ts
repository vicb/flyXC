import { AccountModel, LiveTrackEntity, trackerNames } from '@flyxc/common';
import { Datastore } from '@google-cloud/datastore';

export const LIVE_TRACK_TABLE = 'LiveTrack';
export const NAME_MAX_LENGTH = 30;

// Retrieves a tracker given its Google Id (=oauth sub).
// - Retrieves all the fields,
// - Used to update the account.
export async function retrieveLiveTrackByGoogleId(
  datastore: Datastore,
  googleId: string,
): Promise<LiveTrackEntity | undefined> {
  const query = datastore.createQuery(LIVE_TRACK_TABLE).order('google_id').filter('google_id', googleId).limit(1);
  const [entities] = await datastore.runQuery(query);
  return entities[0];
}

// Retrieves a tracker by datastore id.
export async function retrieveLiveTrackById(datastore: Datastore, id: string): Promise<LiveTrackEntity | undefined> {
  const [entity] = await datastore.get(datastore.key([LIVE_TRACK_TABLE, Number(id)]));
  return entity;
}

// Updates a live track entity with user edits.
export function updateLiveTrackEntityFromModel(
  entity: LiveTrackEntity | undefined,
  account: AccountModel,
  email: string,
  googleId: string,
): LiveTrackEntity {
  const liveTrack: Partial<LiveTrackEntity> = entity ?? {
    email,
    google_id: googleId,
    created: new Date(),
  };

  // Update the entity.
  liveTrack.name = account.name;
  liveTrack.share = account.share;
  liveTrack.enabled = account.enabled;
  liveTrack.updated = new Date();

  for (const tracker of trackerNames) {
    const model = account[tracker];
    // Preserve the current zoleo IMEI.
    let imei: string | undefined;
    if (tracker == 'zoleo') {
      imei = liveTrack[tracker]?.imei ?? '';
    }
    liveTrack[tracker] = {
      enabled: model.enabled,
      account: model.account,
    };
    if (model.account_resolved != null) {
      liveTrack[tracker].account_resolved = model.account_resolved;
    }
    if (imei != null) {
      liveTrack[tracker].imei = imei ?? '';
    }
  }

  return liveTrack as LiveTrackEntity;
}
