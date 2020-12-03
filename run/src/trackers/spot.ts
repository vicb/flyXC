// Spot trackers API.
//
// See https://www.findmespot.com/en-us/support/spot-trace/get-help/general/spot-api-support.

/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
  SPOT_REFRESH_INTERVAL_SEC,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { validateSpotAccount } from 'flyxc/common/src/models';

import { getTrackersToUpdate, LivePoint, makeLiveTrack, ParseError, TrackerUpdate, TrackUpdate } from './live-track';

// Queries the datastore for the devices that have not been updated in REFRESH_EVERY_MINUTES.
// Queries the feeds until the timeout is reached and store the data back into the datastore.
export async function refresh(): Promise<TrackerUpdate> {
  const start = Date.now();
  const timeoutAfter = start + LIVE_FETCH_TIMEOUT_SEC * 1000;

  const trackers = await getTrackersToUpdate(TrackerIds.Spot, start - SPOT_REFRESH_INTERVAL_SEC * 1000, 100);

  const result: TrackerUpdate = {
    trackerId: TrackerIds.Spot,
    tracks: new Map<number, TrackUpdate>(),
    errors: [],
    durationSec: 0,
  };

  for (const tracker of trackers) {
    const id = idFromEntity(tracker);

    // Fetch an extra 30 minutes if some data were in flight.
    const lastFetch = tracker.updated ?? 0;
    const fetchFrom = Math.max(start - LIVE_RETENTION_SEC * 1000, lastFetch - 30 * 60 * 1000);
    const fetchDate = new Date(fetchFrom).toISOString().substring(0, 19) + '-0000';

    const update: TrackUpdate = { updated: start };
    let points: LivePoint[] = [];

    const spotId = validateSpotAccount(tracker.account);

    if (spotId === false) {
      update.error = `The id "${id}" is not valid`;
    } else {
      const url = `https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/${spotId}/message.json?startDate=${fetchDate}`;
      try {
        const response = await request(url);
        if (response.code == 200) {
          points = parse(response.body);
        } else {
          update.error = `HTTP Status = ${response.code} for ${url}`;
        }
      } catch (e) {
        update.error = `Error "${e}" for url ${url}`;
      }
    }

    if (update.error == null && points.length > 0) {
      let track = makeLiveTrack(points);
      track = removeBeforeFromLiveTrack(track, fetchFrom / 1000);
      simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
      update.track = track;
    }

    result.tracks.set(id, update);

    if (Date.now() > timeoutAfter) {
      result.errors.push(`Fetch timeout`);
      break;
    }
  }

  result.durationSec = Math.round((Date.now() - start) / 1000);

  return result;
}

// Parses SPOT json feeds.
//
// Throws:
// - a `ParseError` on invalid feed,
// - an Error if spot response contain an error.
export function parse(jsonFeed: string): LivePoint[] {
  const points: LivePoint[] = [];

  let feed: any;
  try {
    feed = JSON.parse(jsonFeed);
  } catch (e) {
    throw new ParseError('Invalid SPOT json');
  }

  const error = feed?.response?.errors?.error;

  // Code E-0195 is used when there is no fix after the start time.
  if (error && error.code != 'E-0195') {
    throw new Error(error?.description ?? 'Feed error');
  }

  const fixes = feed.response?.feedMessageResponse?.messages?.message;
  if (Array.isArray(fixes)) {
    fixes.forEach((fix: any) => {
      points.push({
        device: TrackerIds.Spot,
        lon: fix.longitude,
        lat: fix.latitude,
        alt: fix.altitude,
        timestamp: fix.unixTime * 1000,
        emergency: fix.messageType == 'HELP',
        message: fix.messageContent,
        lowBattery: fix.batteryState != 'GOOD',
      });
    });
  }

  return points;
}
