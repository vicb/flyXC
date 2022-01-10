import crypto from 'crypto';
import * as protos from 'flyxc/common/protos/track';
import { diffEncodeTrack } from 'flyxc/common/src/runtime-track';
import { getTextRetry } from 'flyxc/common/src/superagent';
import {
  retrieveMetaTrackGroupByHash,
  retrieveMetaTrackGroupByUrl,
  saveTrack,
  TrackEntity,
} from 'flyxc/common/src/track-entity';

import PubSub from '@google-cloud/pubsub';

import { parse as parseGpx } from './gpx';
import { parse as parseIgc } from './igc';
import { parse as parseKml } from './kml';
import { parse as parseTrk } from './trk';

// Returns a track given its url.
// The track is either retrieved from the DB or parsed.
//
// Returns am encoded ProtoTrackGroup.
export async function parseFromUrl(url: string): Promise<protos.MetaTrackGroup> {
  // First check the cache.
  const metaGroup = await retrieveMetaTrackGroupByUrl(url);
  if (metaGroup) {
    console.log(`Cache hit (url = ${url})`);
    return metaGroup;
  }
  console.log(`Cache miss (url = ${url})`);

  try {
    const response = await getTextRetry(url);
    if (response.ok) {
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
  const metaGroup = await retrieveMetaTrackGroupByHash(hash);
  if (metaGroup) {
    console.log(`Cache hit (hash = ${hash})`);
    return metaGroup;
  }
  console.log(`Cache miss (hash = ${hash})`);

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
  if (tracks.length > 0) {
    const trackEntity: TrackEntity = {
      created: new Date(),
      valid: true,
      hash,
      track_group: Buffer.from(trackGroupBin),
      num_postprocess: 0,
      has_postprocess_errors: false,
      url: srcUrl || undefined,
    };
    id = await saveTrack(trackEntity);
    // Publish the created track to PubSub for further processing.
    const client = new PubSub.PubSub();
    await client.topic('projects/fly-xc/topics/track.upload').publishJSON({ id });
  }

  return {
    id,
    numPostprocess: 0,
    trackGroupBin,
  };
}
