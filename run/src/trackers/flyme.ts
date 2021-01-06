// XCGlobe Flyme tracker API.
//
// http://xcglobe.com/flyme/

/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { LiveTrack } from 'flyxc/common/protos/live-track';
import { idFromEntity } from 'flyxc/common/src/datastore';
import { SecretKeys } from 'flyxc/common/src/keys';
import {
  getTrackerFlags,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { TrackerAccountWithServerId } from 'flyxc/common/src/models';

import { getTrackersToUpdate, TrackerForUpdate, TrackerUpdate, TrackUpdate } from './live-track';

// Returns updates for the flyme devices.
export async function refresh(): Promise<TrackerUpdate> {
  const start = Date.now();

  const result: TrackerUpdate = {
    trackerId: TrackerIds.Flyme,
    tracks: new Map<number, TrackUpdate>(),
    accounts: new Map<number, string | false>(),
    errors: [],
    durationSec: 0,
  };

  const trackers = await getTrackersToUpdate(TrackerIds.Flyme, start, 200);

  // Fixes are id, lat, lon, alt, timeSec and username.
  const flymeIdToFix = new Map<number, [number, number, number, number, number, string]>();
  const url = `https://xcglobe.com/livetrack/flyxcPositions?token=${SecretKeys.FLYME_TOKEN}`;
  try {
    const response = await request(url);
    if (response.code == 200) {
      const fixes = JSON.parse(response.body);
      fixes.forEach((fix: [number, number, number, number, number, string]) => {
        const id = fix[0];
        flymeIdToFix.set(id, fix);
      });
    } else {
      result.errors.push(`HTTP status ${response.code}`);
    }
  } catch (e) {
    result.errors.push(`Error ${JSON.stringify(e)}`);
  }

  const resolvePromises: Promise<unknown>[] = [];

  trackers.forEach((tracker: TrackerForUpdate) => {
    const datastoreId = idFromEntity(tracker);
    try {
      const account: TrackerAccountWithServerId = JSON.parse(tracker.account);
      const flymeId = account.id;

      let track: LiveTrack | undefined;

      if (flymeId == null) {
        resolvePromises.push(resolveAccount(account).then((value) => result.accounts?.set(datastoreId, value)));
      } else {
        const lastFetch = tracker.updated ?? 0;
        const startTimestamp = Math.max(start - LIVE_RETENTION_SEC * 1000, lastFetch - 5 * 60 * 1000);
        const fix = flymeIdToFix.get(Number(flymeId));
        if (fix) {
          track = LiveTrack.create({
            lat: [fix[1]],
            lon: [fix[2]],
            alt: [fix[3]],
            timeSec: [fix[4]],
            flags: [getTrackerFlags({ valid: true, device: TrackerIds.Flyme })],
          });
          track = removeBeforeFromLiveTrack(track, startTimestamp / 1000);
        }
      }

      result.tracks.set(datastoreId, {
        updated: start,
        track,
      });
    } catch (e) {
      result.tracks.set(datastoreId, { updated: start, error: e.toString() });
    }
  });

  await Promise.all(resolvePromises);

  result.durationSec = Math.round((Date.now() - start) / 1000);

  return result;
}

// Resolves a FlyMe account.
//
// Returns:
// - a resolved account when the username exists,
// - an unresolved account if it should be retried,
// - false to disable the account if the username does not exist or too many retries.
export async function resolveAccount(account: TrackerAccountWithServerId): Promise<false | string> {
  try {
    const id = await getFlyMeId(account.value);
    return id == null ? false : JSON.stringify({ value: account.value, id });
  } catch (e) {
    console.error(`[FlyMe] Error resolving account: ${e}`);
    const retries = (account.retries ?? 0) + 1;
    return retries > 10 ? false : JSON.stringify({ value: account.value, retries });
  }
}

// Validate the FlyMe id.
export async function validateFlyMeAccount(username: string): Promise<number | false> {
  try {
    const id = await getFlyMeId(username);
    if (id != null) {
      return id;
    }
  } catch (e) {}
  return false;
}

// Fetch the FlyMe server id for the username.
//
// Returns a numeric id when the username exists or undefined.
// Throws when there is a server error or a status code != 200.
export async function getFlyMeId(username: string): Promise<number | undefined> {
  const url = `https://xcglobe.com/livetrack/flyxcRegisterUser?username=${encodeURIComponent(username)}&token=${
    SecretKeys.FLYME_TOKEN
  }`;

  let response: any;

  try {
    response = await request(url);
    if (response.code == 200) {
      const matches = response.body.match(/^ok:\s*(\d+)$/);
      return matches == null ? undefined : Number(matches[1]);
    }
  } catch (e) {
    throw new Error(`Server error: ${JSON.stringify(e)}`);
  }

  throw new Error(`HTTP status code ${response.code}`);
}
