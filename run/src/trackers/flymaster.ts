// Flymaster.

/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { round } from 'flyxc/common/src/math';
import { formatReqError } from 'flyxc/common/src/util';

import { getTrackersToUpdate, LivePoint, makeLiveTrack, TrackerUpdate, TrackUpdate } from './live-track';

// Latency before a fix is available (usually ~4min).
const FLYMASTER_LATENCY_MIN = 5;

// Queries the flymaster API until the timeout is reached and store the data back into the datastore.
export async function refresh(): Promise<TrackerUpdate> {
  const start = Date.now();
  const timeoutAfter = start + LIVE_FETCH_TIMEOUT_SEC * 1000;

  const trackers = await getTrackersToUpdate(TrackerIds.Flymaster, start - LIVE_MINIMAL_INTERVAL_SEC * 1000, 100);

  const result: TrackerUpdate = {
    trackerId: TrackerIds.Flymaster,
    tracks: new Map<number, TrackUpdate>(),
    errors: [],
    durationSec: 0,
  };

  while (trackers.length > 0) {
    // Fetch up to 10 account at once.
    const batchTrackers = trackers.splice(0, 10);
    const flmIdToDsId = new Map<number, number>();

    // Retrieve positions from at least 5min ago (system latency).
    const fetchSecond = Math.round(start / 1000) - FLYMASTER_LATENCY_MIN * 60;
    const trackersParam: {[id: string]: number} = {};

    batchTrackers.forEach((tracker) => {
      const flmId = Number(tracker.account);
      flmIdToDsId.set(flmId, idFromEntity(tracker));
      trackersParam[String(flmId)] = fetchSecond;
    });

    const url = `https://lt.flymaster.net/wlb/getLiveData.php?trackers=${JSON.stringify(trackersParam)}`;

    let flights: {[id: string]: any} = {};
    let isError = false;

    try {
      const response = await request(url);
      if (response.code == 200) {
        flights = JSON.parse(response.body);
      } else {
        isError = true;
        result.errors.push(`HTTP Status = ${response.code} for ${url}`);
      }
    } catch (e) {
      isError = true;
      result.errors.push(`Error ${formatReqError(e)} for url ${url}`);
    }

    Object.entries(flights).forEach(([id, flight]) => {
      const flmId = Number(id);
      const dsId = flmIdToDsId.get(flmId) as number;
      // Get an extra 5min of data that might not have been received (when no network coverage).
      const points = parse(flight);
      let track = makeLiveTrack(points);
      track = removeBeforeFromLiveTrack(track, fetchSecond - 100);
      simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
      result.tracks.set(dsId, {
        track,
        updated: start,
      });
    });

    // Flymaster only returns a track if the flight has points.
    for (const dsId of flmIdToDsId.values()) {
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

// Parses a Flymaster flight.
export function parse(flight: any): LivePoint[] {
  return flight.map(
    (fix: any): LivePoint => ({
      device: TrackerIds.Flymaster,
      lat: round(fix.ai / 60000, 5),
      lon: round(fix.oi / 60000, 5),
      alt: Math.round(fix.h),
      gndAlt: Math.round(fix.s),
      speed: Math.round(fix.v),
      timestamp: fix.d * 1000,
    }),
  );
}
