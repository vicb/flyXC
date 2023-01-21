import { AccountModel, LiveTrackEntity, TrackerModel, trackerNames } from '@flyxc/common';
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
export function UpdateLiveTrackEntityFromModel(
  entity: LiveTrackEntity | undefined,
  account: AccountModel,
  email: string,
  googleId: string,
): LiveTrackEntity {
  const liveTrack: Partial<LiveTrackEntity> = entity ?? {
    email,
    google_id: googleId,
    created: new Date(),
    updated: new Date(),
  };

  // Update the entity.
  liveTrack.name = account.name;
  liveTrack.share = account.share;
  liveTrack.enabled = account.enabled;
  liveTrack.updated = new Date();

  for (const prop of trackerNames) {
    const model: TrackerModel = account[prop];
    liveTrack[prop] = {
      enabled: model.enabled,
      account: model.account,
    };
    if (model.account_resolved != null) {
      liveTrack[prop].account_resolved = model.account_resolved;
    }
  }

  return liveTrack as LiveTrackEntity;
}
