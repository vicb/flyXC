/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
const { PubSub } = require('@google-cloud/pubsub');
const request = require('request-zero');

import crypto from 'crypto';
import {
  retrieveMetaTrackGroupByHash,
  retrieveMetaTrackGroupByUrl,
  saveTrack,
  TrackEntity,
} from 'flyxc/common/datastore';
import * as protos from 'flyxc/common/protos/track';
import { diffEncodeTrack } from 'flyxc/common/track';

import { parse as parseGpx } from './gpx';
import { parse as parseIgc } from './igc';
import { parse as parseKml } from './kml';
import { parse as parseTrk } from './trk';

const datastore = new Datastore();

// Returns the latest submitted track from the Data Store.
export async function getTracksMostRecentFirst(maxTracks: number): Promise<any[]> {
  if (!process.env.USE_CACHE) {
    return [];
  }
  maxTracks = Math.min(maxTracks, 100);
  const query = datastore.createQuery('Track').order('created', { descending: true }).limit(maxTracks);
  const items: TrackEntity[] = (await datastore.runQuery(query))[0];
  return items.filter((entity) => entity.hash != null);
}

// Returns a track given its url.
// The track is either retrieved from the DB or parsed.
//
// Returns am encoded ProtoTrackGroup.
export async function parseFromUrl(url: string): Promise<protos.MetaTrackGroup> {
  // First check the cache.
  if (process.env.USE_CACHE) {
    const metaGroup = await retrieveMetaTrackGroupByUrl(url);
    if (metaGroup) {
      console.log(`Cache hit (url = ${url})`);
      return metaGroup;
    }
    console.log(`Cache miss (url = ${url})`);
  }

  try {
    const response = await request(url);
    if (response.code == 200) {
      return await parse(response.body, url);
    }
  } catch (e) {}
  return { id: -1, numPostprocess: 0 };
}

// Parses the string `content` and try to find one or more tracks.
//
// When the cache is enabled, already processed content is returned immediately.
// Otherwise we try to parse the content as any of the supported formats.
export async function parse(content: string, srcUrl: string | null = null): Promise<protos.MetaTrackGroup> {
  // First check the cache
  const hash = crypto.createHash('md5').update(content).digest('hex');
  if (process.env.USE_CACHE) {
    const metaGroup = await retrieveMetaTrackGroupByHash(hash);
    if (metaGroup) {
      console.log(`Cache hit (hash = ${hash})`);
      return metaGroup;
    }
    console.log(`Cache miss (hash = ${hash})`);
  }

  // rawTracks are not differential encoded
  let tracks: protos.Track[] = parseIgc(content);
  if (!tracks.length) {
    tracks = parseTrk(content);
  }
  if (!tracks.length) {
    tracks = parseGpx(content);
  }
  if (!tracks.length) {
    tracks = parseKml(content);
  }
  if (tracks.length == 0) {
    console.error(`Can not parse tracks`);
    return { id: -1, numPostprocess: 0 };
  }

  let id = -1;
  const trackGroupBin = protos.TrackGroup.toBinary({ tracks: tracks.map(diffEncodeTrack) });

  // Save the entity in cache
  if (process.env.USE_CACHE && tracks.length > 0) {
    const trackEntity: TrackEntity = {
      created: new Date(),
      valid: true,
      hash,
      track_group: trackGroupBin,
      num_postprocess: 0,
      has_postprocess_errors: false,
      url: srcUrl || undefined,
    };
    id = await saveTrack(trackEntity);
    // Publish the created track to PubSub for further processing.
    const client = new PubSub();
    await client.topic('projects/fly-xc/topics/track.upload').publishJSON({ id });
  }

  return {
    id,
    numPostprocess: 0,
    trackGroupBin,
  };
}
