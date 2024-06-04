import { diffEncodeTrack, fetchResponse, formatReqError, protos } from '@flyxc/common';
import type { TrackEntity } from '@flyxc/common-node';
import {
  retrieveMetaTrackGroupByHash,
  retrieveMetaTrackGroupByUrl,
  saveTrack,
  queueTrackPostProcessing,
} from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import * as crypto from 'node:crypto';
import { parse as parseGpx, parseRoute as parseGpxRoute } from './gpx';
import { parse as parseIgc } from './igc';
import { parse as parseKml } from './kml';
import { parse as parseTrk } from './trk';
import { parse as parseXctsk } from './xctsk';

// Returns a track given its url.
// The track is either retrieved from the DB or parsed.
//
// Returns am encoded ProtoTrackGroup.
export async function parseFromUrl(datastore: Datastore, url: string): Promise<protos.MetaTrackGroup> {
  // First check the cache.
  const metaGroup = await retrieveMetaTrackGroupByUrl(datastore, url);
  if (metaGroup) {
    console.log(`Cache hit (url = ${url})`);
    return metaGroup;
  }
  console.log(`Cache miss (url = ${url})`);

  try {
    const response = await fetchResponse(url, { timeoutS: 5 });
    if (response.ok) {
      return await parse(datastore, await response.text(), url);
    }
    console.error(`HTTP Status ${response.status}`);
  } catch (e) {
    console.error(`fetch error ${formatReqError(e)}`);
  }
  return { id: -1, numPostprocess: 0 };
}

// Parses the string `content` and try to find one or more tracks.
//
// When the cache is enabled, already processed content is returned immediately.
// Otherwise we try to parse the content as any of the supported formats.
export async function parse(
  datastore: Datastore,
  content: string,
  srcUrl: string | null = null,
): Promise<protos.MetaTrackGroup> {
  // First check the cache
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const metaGroup = await retrieveMetaTrackGroupByHash(datastore, hash);
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

  // The time is encoded as int32 in protos.
  for (const track of tracks) {
    track.timeSec = track.timeSec.map((t) => Math.min(t, 2 ** 31 - 1));
  }

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
      url: srcUrl ?? undefined,
    };
    id = await saveTrack(datastore, trackEntity);
    await queueTrackPostProcessing(id);
  }

  return {
    id,
    numPostprocess: 0,
    trackGroupBin,
  };
}

export function parseRoute(content: string): protos.Route | null {
  return parseXctsk(content) || parseGpxRoute(content);
}
