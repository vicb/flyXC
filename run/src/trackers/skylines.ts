// Skylines API.
//
// See https://github.com/skylines-project/skylines.

/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { round } from 'flyxc/common/src/math';
import { formatReqError } from 'flyxc/common/src/util';
import { decodeDeltas } from 'ol/format/Polyline';

import { getTrackersToUpdate, LivePoint, makeLiveTrack, TrackerUpdate, TrackUpdate } from './live-track';

const SECONDS_IN_DAY = 60 * 60 * 24;

// Queries the datastore for the devices that have not been updated in REFRESH_EVERY_MINUTES.
// Queries the skylines API until the timeout is reached and store the data back into the datastore.
export async function refresh(): Promise<TrackerUpdate> {
  const start = Date.now();
  const timeoutAfter = start + LIVE_FETCH_TIMEOUT_SEC * 1000;

  const trackers = await getTrackersToUpdate(TrackerIds.Skylines, start - LIVE_MINIMAL_INTERVAL_SEC * 1000, 100);

  const result: TrackerUpdate = {
    trackerId: TrackerIds.Skylines,
    tracks: new Map<number, TrackUpdate>(),
    errors: [],
    durationSec: 0,
  };

  while (trackers.length > 0) {
    // Fetch up to 10 account at once.
    const batchTrackers = trackers.splice(0, 10);
    const sklIdToDsId = new Map<number, number>();
    const sklIdToUpdated = new Map<number, number>();

    batchTrackers.forEach((tracker) => {
      const sklId = Number(tracker.account);
      sklIdToDsId.set(sklId, idFromEntity(tracker));
      const updated = tracker.updated;
      sklIdToUpdated.set(sklId, updated);
    });

    const url = `https://skylines.aero/api/live/${[...sklIdToDsId.keys()].join(',')}`;

    const flights: any[] = [];
    let isError = false;

    try {
      const response = await request(url);
      if (response.code == 200) {
        flights.push(...JSON.parse(response.body).flights);
      } else {
        isError = true;
        result.errors.push(`HTTP Status = ${response.code} for ${url}`);
      }
    } catch (e) {
      isError = true;
      result.errors.push(`Error ${formatReqError(e)} for url ${url}`);
    }

    flights.forEach((flight) => {
      const sklId = Number(flight.sfid);
      const dsId = sklIdToDsId.get(sklId) as number;
      // Get an extra 5min of data that might not have been received (when no network coverage).
      const lastUpdate = sklIdToUpdated.get(sklId) ?? 0;
      const startTimestamp = Math.max(start - LIVE_RETENTION_SEC * 1000, lastUpdate - 5 * 60 * 1000);
      const points = parse(flight);
      let track = makeLiveTrack(points);
      track = removeBeforeFromLiveTrack(track, startTimestamp / 1000);
      simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
      result.tracks.set(dsId, {
        track,
        updated: start,
      });
    });

    // Skylines only returns a track if the flight has points.
    for (const dsId of sklIdToDsId.values()) {
      if (!result.tracks.has(dsId)) {
        const update: TrackUpdate = { updated: start };
        if (isError) {
          update.error = 'Batch Error';
        }
        result.tracks.set(dsId, update);
      }
    }

    if (Date.now() > timeoutAfter) {
      result.errors.push(`Fetch timeout.`);
      break;
    }
  }

  result.durationSec = Math.round((Date.now() - start) / 1000);

  return result;
}

// Parses a SkyLines flight.
export function parse(flight: any, nowMillis = Date.now()): LivePoint[] {
  const time = decodeDeltas(flight.barogram_t, 1, 1);
  const lonlat = decodeDeltas(flight.points, 2);
  const height = decodeDeltas(flight.barogram_h, 1, 1);

  // startSeconds reference is a number of seconds since midnight UTC the day the track started.
  const startSeconds = time[0];
  // startDaySeconds is the number of seconds since previous midnight UTC.
  const startDaySeconds = time[0] % SECONDS_IN_DAY;
  // Current timestamp in seconds.
  const nowSeconds = Math.ceil(nowMillis / 1000);
  // Number of seconds since midnight UTC.
  const nowDaySeconds = nowSeconds % SECONDS_IN_DAY;
  const startedOnPreviousDay = startDaySeconds > nowDaySeconds;
  const startOfCurrentDayInSeconds = nowSeconds - nowDaySeconds;
  // Timestamp of the first fix.
  // Start of the current day - 24h if the track was started on the previous day + seconds in day of the first fix.
  const startTimestampSeconds =
    startOfCurrentDayInSeconds - (startedOnPreviousDay ? SECONDS_IN_DAY : 0) + startDaySeconds;

  return time.map(
    (seconds: number, i: number): LivePoint => {
      const tsSeconds = startTimestampSeconds + seconds - startSeconds;
      return {
        device: TrackerIds.Skylines,
        lat: round(lonlat[i * 2], 5),
        lon: round(lonlat[i * 2 + 1], 5),
        alt: Math.round(height[i]),
        timestamp: tsSeconds * 1000,
      };
    },
  );
}
