import { Datastore, Key } from '@google-cloud/datastore';

import { trackerPropNames as trackerPropNames } from './live-track';
import { AccountModel, AccountTransformer, accountTransformers, TrackerModel } from './models';

const datastore = new Datastore();

export const LIVE_TRACK_TABLE = 'LiveTrack';
export const NAME_MAX_LENGTH = 30;

export interface TrackerEntity {
  enabled: boolean;
  account: string;
  // Last time the tracker was updated without errors.
  updated: number;
  // Error and requests as an int: EEERRR.
  errors_requests: number;
}

// A tracker user in the DataStore.
export interface LiveTrackEntity {
  [Datastore.KEY]: Key;
  email: string;
  name: string;
  google_id: string;
  created: Date;
  last_fix_sec: number;
  track: Buffer | null;
  // Whether to share positions with partners.
  share: boolean;
  // Whether to display the user on flyxc.
  enabled: boolean;
  // Trackers.
  // The name must be in sync with TrackerProps.
  inreach: TrackerEntity;
  spot: TrackerEntity;
  skylines: TrackerEntity;
  flyme: TrackerEntity;
}

// Retrieves a tracker given its Google Id (=oauth sub).
// - Retrieves all the fields,
// - Used to update the account.
export async function retrieveTrackerByGoogleId(googleId: string): Promise<LiveTrackEntity | null> {
  const query = datastore.createQuery(LIVE_TRACK_TABLE).order('google_id').filter('google_id', googleId).limit(1);
  const [entities] = await datastore.runQuery(query);
  return entities[0] ?? null;
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
  };

  // Update the entity.
  liveTrack.name = account.name;
  liveTrack.share = account.share;
  liveTrack.enabled = account.enabled;
  liveTrack.last_fix_sec = 0;
  liveTrack.track = null;

  for (const [trackerKey, prop] of Object.entries(trackerPropNames)) {
    const model: TrackerModel = (account as any)[prop];
    const transformer: AccountTransformer = (accountTransformers as any)[trackerKey];
    (liveTrack as any)[prop] = {
      enabled: model.enabled,
      account: transformer.toServerAccount(model.account),
      errors_requests: 0,
      updated: 0,
    };
  }

  return liveTrack as LiveTrackEntity;
}
