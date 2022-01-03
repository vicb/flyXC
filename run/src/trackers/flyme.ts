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
import { formatReqError } from 'flyxc/common/src/util';

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
    result.errors.push(`Error ${formatReqError(e)}`);
  }

  trackers.forEach((tracker: TrackerForUpdate) => {
    const datastoreId = idFromEntity(tracker);
    try {
      const flymeId = tracker.account_resolved ?? '';

      let track: LiveTrack | undefined;

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

      result.tracks.set(datastoreId, {
        updated: start,
        track,
      });
    } catch (e) {
      result.tracks.set(datastoreId, { updated: start, error: JSON.stringify(e) });
    }
  });

  result.durationSec = Math.round((Date.now() - start) / 1000);

  return result;
}

// Fetch the FlyMe server id for the username.
//
// Returns a numeric id when the username exists or undefined.
// Throws when there is a server error or a status code != 200.
export async function getFlyMeId(username: string): Promise<string | undefined> {
  const url = `https://xcglobe.com/livetrack/flyxcRegisterUser?username=${encodeURIComponent(username)}&token=${
    SecretKeys.FLYME_TOKEN
  }`;

  let response: any;

  try {
    response = await request(url, { maxRetry: 3, retryDelay: 100 });
  } catch (e) {
    throw new Error(`Flyme server error`);
  }

  if (response.code == 200) {
    const matches = response.body.match(/^ok:\s*(\d+)$/);
    if (matches == null) {
      throw new Error(`The FlyMe account can not be found`);
    }
    return matches[1];
  }

  throw new Error(`Flyme server error`);
}
