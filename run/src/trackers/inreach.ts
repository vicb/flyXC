// InReach tracker API.
//
// See https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8.

/* eslint-disable @typescript-eslint/no-var-requires */
const request = require('request-zero');

import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  INREACH_REFRESH_INTERVAL_SEC,
  LIVE_FETCH_TIMEOUT_SEC,
  LIVE_MINIMAL_INTERVAL_SEC,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { validateInreachAccount } from 'flyxc/common/src/models';
import { DOMParser } from 'xmldom';

import { getTrackersToUpdate, LivePoint, makeLiveTrack, ParseError, TrackerUpdate, TrackUpdate } from './live-track';

// Queries the datastore for the devices that have not been updated in REFRESH_EVERY_MINUTES.
// Queries the feeds until the timeout is reached and store the data back into the datastore.
export async function refresh(): Promise<TrackerUpdate> {
  const start = Date.now();
  const timeoutAfter = start + LIVE_FETCH_TIMEOUT_SEC * 1000;

  const trackers = await getTrackersToUpdate(TrackerIds.Inreach, start - INREACH_REFRESH_INTERVAL_SEC * 1000, 100);

  const result: TrackerUpdate = {
    trackerId: TrackerIds.Inreach,
    tracks: new Map<number, TrackUpdate>(),
    errors: [],
    durationSec: 0,
  };

  for (const tracker of trackers) {
    const id = idFromEntity(tracker);

    // Fetch an extra 30 minutes if some data were in flight.
    const lastFetch = tracker.updated ?? 0;
    const fetchFrom = Math.max(start - LIVE_RETENTION_SEC * 1000, lastFetch - 30 * 60 * 1000);

    const update: TrackUpdate = { updated: start };
    let points: LivePoint[] = [];

    const inreachUrl = validateInreachAccount(tracker.account);

    if (inreachUrl === false) {
      update.error = `The url ${inreachUrl} is not valid`;
    } else {
      const url = `${inreachUrl}?d1=${new Date(fetchFrom).toISOString()}`;

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

// Parses the kml feed to a list of `LivePoint`s.
//
// Throws a `ParseError` on invalid feed.
export function parse(kmlFeed: string): LivePoint[] {
  const points: LivePoint[] = [];

  if (kmlFeed.length == 0) {
    return points;
  }
  const parser = new DOMParser({
    errorHandler: (level: string, msg: string): void => {
      if (/error/i.test(level)) {
        throw new ParseError(`Invalid InReach feed (${msg})`);
      }
    },
  });

  const placemarks = parser.parseFromString(kmlFeed).getElementsByTagName('Placemark');

  for (let p = 0; p < placemarks.length; p++) {
    const placemark = placemarks[p];
    const coordinates = getChildNode(placemark.childNodes, 'Point.coordinates')?.firstChild?.nodeValue;
    const time = getChildNode(placemark.childNodes, 'TimeStamp.when')?.firstChild?.nodeValue;
    const extendedDataNode = getChildNode(placemark.childNodes, 'ExtendedData');
    const extendedData = extendedDataNode ? getExtendedDataMap(extendedDataNode) : null;
    const message = getChildNode(placemark.childNodes, 'description')?.firstChild?.nodeValue;

    if (coordinates && time && extendedData) {
      const [lon, lat, alt] = coordinates
        .trim()
        .split(',')
        .map((v: string) => Number(v));

      points.push({
        device: TrackerIds.Inreach,
        lon,
        lat,
        alt: Math.round(alt),
        timestamp: new Date(time).getTime(),
        message,
        speed: Number(extendedData['Velocity'].replace(/^([\d]+).*/, '$1')),
        emergency: extendedData['In Emergency'] !== 'False',
        valid: extendedData['Valid GPS Fix'] === 'True',
      });
    }
  }

  return points;
}

// Returns a child node by "." delimited path.
function getChildNode(nodeList: NodeListOf<ChildNode>, tagPath: string): ChildNode | null {
  const tagName = tagPath.split('.')[0];
  for (let i = 0; i < nodeList.length; i++) {
    const el = nodeList[i] as Element;
    if (el.tagName == tagName) {
      if (tagName == tagPath) {
        return el;
      }
      return getChildNode(nodeList[i].childNodes, tagPath.substr(tagName.length + 1));
    }
  }
  return null;
}

// Returns the ExtendedData node as a key-value list.
function getExtendedDataMap(extendedData: ChildNode): { [k: string]: string } {
  const data: { [k: string]: string } = {};
  const childNodes = extendedData?.childNodes || [];
  for (let d = 0; d < childNodes.length; d++) {
    const el = childNodes[d] as Element;
    if (el.tagName == 'Data' && el.childNodes) {
      const id = el.getAttribute('name');
      if (id != null) {
        const value = getChildNode(el.childNodes, 'value')?.firstChild?.nodeValue;
        data[id] = value ?? '';
      }
    }
  }
  return data;
}
