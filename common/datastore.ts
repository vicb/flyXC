/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
/* eslint-enable @typescript-eslint/no-var-requires */

import zlib from 'zlib';

import { ProtoMetaTrackGroup } from './track';

const datastore = new Datastore();

const key_symbol: unique symbol = datastore.KEY;

// A track as stored in datastore.
// The ArrayBuffer zre stored gzipped in the datastore.
// They are automatically compressed and expanded when using the API in this file.
export interface TrackEntity {
  [key_symbol]?: any;
  created: Date;
  city?: string;
  country?: string;
  // TODO: delete after migration
  data?: ArrayBuffer;
  // GroundAltitudeGroup.
  ground_altitude_group?: ArrayBuffer;
  // Whether there are some post-processing errors
  has_postprocess_errors: boolean;
  hash: string;
  // Incremented after each post processing.
  num_postprocess: number;
  // Simplified path (polyline encoded).
  path?: string;
  // ProtoTrackGroup.
  track_group?: ArrayBuffer;
  // url of the track (when loaded from an url).
  url?: string;
  valid: boolean;
}

// Saves an entity to the datastore.
// Large protobufs are automatically gzipped before being stored.
// Returns the id of the track.
export async function saveTrack(track: TrackEntity): Promise<number> {
  // Use the existing entity when it has a key.
  const key = track[key_symbol] ?? datastore.key('Track');

  await datastore.save({
    key,
    excludeFromIndexes: ['data', 'ground_altitude_group', 'path', 'track_group'],
    data: {
      ...track,
      // TODO: delete after migration
      data: zipOrUndefined(track.data),
      ground_altitude_group: zipOrUndefined(track.ground_altitude_group),
      track_group: zipOrUndefined(track.track_group),
    },
  });
  return key.id;
}

// Retrieves a meta track group given its hash.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupByHash(hash: string): Promise<ProtoMetaTrackGroup | null> {
  if (process.env.USE_CACHE) {
    const query = datastore.createQuery('Track').filter('hash', hash).limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      return entityToMetaTrackGroup(entities[0]);
    }
  }
  return null;
}

// Retrieves a meta track group given its url.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupByUrl(url: string): Promise<ProtoMetaTrackGroup | null> {
  if (process.env.USE_CACHE) {
    const query = datastore.createQuery('Track').filter('url', url).filter('valid', true).limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      return entityToMetaTrackGroup(entities[0]);
    }
  }
  return null;
}

// Retrieves a meta track group given its url.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupsByIds(ids: Array<number | string>): Promise<ProtoMetaTrackGroup[]> {
  if (process.env.USE_CACHE) {
    const entities = await datastore.get(ids.map((id) => datastore.key(['Track', Number(id)])));
    return entities[0].map(entityToMetaTrackGroup);
  }
  return [];
}

// Retrieves a track entity given its datastore id.
// Gzipped fields are expanded in the return value.
export async function retrieveTrackById(id: number | string): Promise<TrackEntity | null> {
  if (process.env.USE_CACHE) {
    const entities = await datastore.get(datastore.key(['Track', Number(id)]));
    if (entities[0] != null) {
      return unzipEntity(entities[0]);
    }
  }
  return null;
}

// Converts a gzipped entity to a Meta Track Group.
function entityToMetaTrackGroup(entity: TrackEntity): ProtoMetaTrackGroup {
  if (!(key_symbol in entity)) {
    throw new Error('An ID is required');
  }

  entity = unzipEntity(entity);

  return {
    id: entity[key_symbol].id as number,
    num_postprocess: entity.num_postprocess,
    track_group_bin: entity.track_group,
    ground_altitude_group_bin: entity.ground_altitude_group,
  };
}

function zipOrUndefined(buffer: ArrayBuffer | undefined): ArrayBuffer | undefined {
  return buffer == null ? undefined : zlib.gzipSync(buffer, { level: 9 });
}

function unzipOrUndefined(buffer: ArrayBuffer | undefined): ArrayBuffer | undefined {
  return buffer == null ? undefined : zlib.gunzipSync(buffer);
}

// Expands entity gzipped fields.
function unzipEntity(track: TrackEntity): TrackEntity {
  return {
    ...track,
    // TODO: delete after migration
    data: unzipOrUndefined(track.data),
    track_group: unzipOrUndefined(track.track_group),
    ground_altitude_group: unzipOrUndefined(track.ground_altitude_group),
  };
}
