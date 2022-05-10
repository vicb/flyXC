// Spot trackers API.
//
// See https://www.findmespot.com/en-us/support/spot-trace/get-help/general/spot-api-support.

import { Tracker } from 'flyxc/common/protos/fetcher-state';
import { fetchResponse } from 'flyxc/common/src/fetch-timeout';
import { LIVE_MINIMAL_INTERVAL_SEC, simplifyLiveTrack, TrackerIds } from 'flyxc/common/src/live-track';
import { validateSpotAccount } from 'flyxc/common/src/models';
import { formatReqError } from 'flyxc/common/src/util';

import { LivePoint, makeLiveTrack } from './live-track';
import { TrackerFetcher, TrackerUpdates } from './tracker';

export class SpotFetcher extends TrackerFetcher {
  protected getTrackerId(): TrackerIds {
    return TrackerIds.Spot;
  }

  protected async fetch(devices: number[], updates: TrackerUpdates, timeoutSec: number): Promise<void> {
    const deadlineMs = Date.now() + timeoutSec * 1000;

    for (const id of devices) {
      const tracker = this.getTracker(id);
      if (tracker == null) {
        continue;
      }
      if (validateSpotAccount(tracker.account) === false) {
        updates.trackerErrors.set(id, `Invalid account ${tracker.account}`);
        continue;
      }
      const fetchFromSec = this.getTrackerFetchFromSec(id, updates.startFetchSec, 2 * 3600);
      const fetchDate = new Date(fetchFromSec * 1000).toISOString().substring(0, 19) + '-0000';
      const url = `https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/${tracker.account}/message.json?startDate=${fetchDate}`;
      try {
        updates.fetchedTracker.add(id);
        const response = await fetchResponse(url);
        if (response.ok) {
          try {
            const points = parse(await response.text());
            const track = makeLiveTrack(points);
            simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
            if (track.timeSec.length > 0) {
              updates.trackerDeltas.set(id, track);
            }
          } catch (e) {
            updates.trackerErrors.set(id, `Error parsing the json for ${id}\n${e}`);
          }
        } else {
          updates.trackerErrors.set(id, `HTTP Status = ${response.status} for ${url}`);
        }
      } catch (e) {
        updates.trackerErrors.set(id, `Error ${formatReqError(e)} for url ${url}`);
      }

      if (Date.now() >= deadlineMs) {
        updates.errors.push(`Fetch timeout`);
        break;
      }
    }
  }

  protected getNextFetchAfterSec(tracker: Readonly<Tracker>): number {
    if (tracker.numConsecutiveErrors > 30) {
      return 24 * 3600;
    }
    if (tracker.numConsecutiveErrors > 20) {
      return 3600;
    }
    if (tracker.numConsecutiveErrors > 10) {
      return 10 * 60;
    }
    if (tracker.numConsecutiveErrors == 1 || tracker.numConsecutiveErrors == 2) {
      // Retry fast on few errors.
      return 60;
    }
    const lastFixAgeSec = Math.round(Date.now() / 1000) - tracker.lastFixSec;
    if (lastFixAgeSec > 3 * 30 * 24 * 3600) {
      return 20 * 60;
    }
    if (lastFixAgeSec > 3 * 3600) {
      return Math.floor(9 + Math.random() * 3) * 60;
    }
    if (lastFixAgeSec > 1800) {
      return Math.floor(3 + Math.random() * 3) * 60;
    }
    return 60;
  }
}

// Parses SPOT json feeds.
//
// Throws:
// - an Error on invalid feed,
// - an Error if spot response contain an error.
export function parse(jsonFeed: string): LivePoint[] {
  const points: LivePoint[] = [];

  let feed: any;
  try {
    feed = JSON.parse(jsonFeed);
  } catch (e) {
    throw new Error(`Invalid SPOT json - feed: ${jsonFeed}`);
  }

  // error could be a single object or an array ob objects.
  const error = feed?.response?.errors?.error;

  if (error) {
    const errors: any[] = [].concat(error);
    // Code E-0195 is used when there is no fix after the start time.
    if (errors.some((e) => e.code === 'E-0195')) {
      return points;
    }
    throw new Error(error.description ?? `Feed error ${error.code} - feed: ${jsonFeed}`);
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
        // Values could be "GOOD" or "LOW".
        lowBattery: fix.batteryState == 'LOW',
      });
    });
  }

  return points;
}
