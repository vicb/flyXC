import type { AccountModel, LiveTrackEntity } from '@flyxc/common';
import { trackerNames } from '@flyxc/common';
import type { Datastore } from '@google-cloud/datastore';

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

/**
 * Updates a Datastore `LiveTrackEntity` with data from a user-submitted `AccountModel` (or initializes a new one).
 *
 * **What it does**:
 * - Populates or updates basic account properties (`name`, `share`, `enabled`, and `updated` timestamp;
 *   sets `email`, `google_id`, and `created` timestamp when creating a new entity).
 * - Copies `enabled` and `account` settings for each supported tracker.
 * - Handles `zoleo` specially: only updates its `enabled` status while preserving existing `account` (IMEI)
 *   and `device_id`, since Zoleo device linking is handled out-of-band via dedicated `/api/zoleo/link`,
 *   `/api/zoleo/unlink`, and push consent webhooks.
 *
 * **When it is called**:
 * - Called by the server in `createOrUpdateLiveTrack` when processing user settings form submissions
 *   (`POST /api/live/account.json`), right after form validation and immediately before saving the entity
 *   to Datastore and notifying the fetcher to sync.
 *
 * @param entity - The existing Datastore entity, or `undefined` if this is the user's first time saving settings.
 * @param accountModel - The validated account settings submitted from the client.
 * @param email - The authenticated user's email address.
 * @param googleId - The authenticated user's Google OAuth ID (subject).
 * @returns The updated `LiveTrackEntity` ready to be saved to Datastore.
 */
export function updateLiveTrackEntityFromModel(
  entity: LiveTrackEntity | undefined,
  accountModel: AccountModel,
  email: string,
  googleId: string,
): LiveTrackEntity {
  entity ??= {
    email,
    google_id: googleId,
    created: new Date(),
  } as LiveTrackEntity;

  // Update the entity.
  entity.name = accountModel.name;
  entity.share = accountModel.share;
  entity.enabled = accountModel.enabled;
  entity.updated = new Date();

  for (const trackerName of trackerNames) {
    const trackerModel = accountModel[trackerName];
    if (trackerName === 'zoleo') {
      // Zoleo account (IMEI) and device_id are managed out-of-band by /link, /unlink, and consent webhooks.
      // Saving the account form should only update the enabled state and never overwrite account or device_id.
      entity.zoleo = {
        account: entity.zoleo?.account ?? '',
        device_id: entity.zoleo?.device_id ?? '',
        enabled: trackerModel.enabled,
      };
    } else if (trackerName === 'flyme') {
      entity[trackerName] = {
        account: trackerModel.account,
        enabled: trackerModel.enabled,
        account_resolved: trackerModel.account_resolved ?? '',
      };
    } else {
      entity[trackerName] = {
        account: trackerModel.account,
        enabled: trackerModel.enabled,
      };
    }
  }

  return entity;
}
