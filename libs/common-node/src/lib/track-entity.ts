import { protos } from '@flyxc/common';
import { Datastore, Key } from '@google-cloud/datastore';
import * as zlib from 'zlib';

const datastore = new Datastore();

export const TRACK_TABLE = 'Track';

// A track as stored in datastore.
// The ArrayBuffer zre stored gzipped in the datastore.
// They are automatically compressed and expanded when using the API in this file.
export interface TrackEntity {
  [Datastore.KEY]?: Key;
  airspaces_group?: Buffer;
  created: Date;
  city?: string;
  country?: string;
  // GroundAltitudeGroup.
  ground_altitude_group?: Buffer;
  // Whether there are some post-processing errors
  has_postprocess_errors?: boolean;
  hash?: string;
  // Incremented after each post processing.
  num_postprocess?: number;
  // Simplified path (polyline encoded).
  path?: string;
  // ProtoTrackGroup.
  track_group?: Buffer;
  // url of the track (when loaded from an url).
  url?: string;
  valid?: boolean;
}

// Saves an entity to the datastore.
// Large protobufs are automatically gzipped before being stored.
// Returns the id of the track.
export async function saveTrack(track: TrackEntity): Promise<number> {
  // Use the existing entity when it has a key.
  const key = track[Datastore.KEY] ?? datastore.key(TRACK_TABLE);

  await datastore.save({
    key,
    excludeFromIndexes: ['airspaces_group', 'ground_altitude_group', 'path', 'track_group'],
    data: {
      ...track,
      airspaces_group: zipOrUndefined(track.airspaces_group),
      ground_altitude_group: zipOrUndefined(track.ground_altitude_group),
      track_group: zipOrUndefined(track.track_group),
    },
  });
  return Number(key.id as string);
}

// Updates existing track entities from unzipped entities.
export async function updateUnzippedTracks(tracks: TrackEntity[]): Promise<void> {
  const updates: unknown[] = [];

  for (const track of tracks) {
    const key = track[Datastore.KEY];

    if (key == null) {
      continue;
    }

    updates.push({
      key,
      excludeFromIndexes: ['airspaces_group', 'ground_altitude_group', 'path', 'track_group'],
      data: {
        ...track,
        airspaces_group: zipOrUndefined(track.airspaces_group),
        ground_altitude_group: zipOrUndefined(track.ground_altitude_group),
        track_group: zipOrUndefined(track.track_group),
      },
    });
  }

  await datastore.save(updates);
}

// Retrieves a meta track group given its hash.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupByHash(hash: string): Promise<protos.MetaTrackGroup | null> {
  const query = datastore.createQuery(TRACK_TABLE).filter('hash', hash).limit(1);
  const [entities] = await datastore.runQuery(query);
  return entities.length == 1 ? entityToMetaTrackGroup(entities[0]) : null;
}

// Retrieves a meta track group given its url.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupByUrl(url: string): Promise<protos.MetaTrackGroup | null> {
  const query = datastore.createQuery(TRACK_TABLE).filter('url', url).filter('valid', true).limit(1);
  const [entities] = await datastore.runQuery(query);
  return entities.length == 1 ? entityToMetaTrackGroup(entities[0]) : null;
}

// Retrieves a meta track group given its datastore id.
//
// Note:
// There can be no select clause here are fields are not indexed.
// See https://cloud.google.com/datastore/docs/concepts/queries#projection_queries
export async function retrieveMetaTrackGroupsByIds(ids: Array<number | string>): Promise<protos.MetaTrackGroup[]> {
  const entities = await datastore.get(ids.map((id) => datastore.key([TRACK_TABLE, Number(id)])));
  return entities[0].map((e: TrackEntity) => entityToMetaTrackGroup(e));
}

// Retrieves a track entity given its datastore id.
// Gzipped fields are expanded in the return value.
export async function retrieveTrackById(id: number | string): Promise<TrackEntity | null> {
  const entities = await datastore.get(datastore.key([TRACK_TABLE, Number(id)]));
  return entities[0] != null ? unzipEntity(entities[0]) : null;
}

// Returns the latest submitted track from the Data Store.
export async function retrieveRecentTracks(maxTracks: number): Promise<TrackEntity[]> {
  maxTracks = Math.min(maxTracks, 100);
  const query = datastore.createQuery(TRACK_TABLE).order('created', { descending: true }).limit(maxTracks);
  const [items] = await datastore.runQuery(query);
  return items.filter((entity: TrackEntity) => entity.hash != null);
}

// Converts a gzipped entity to a Meta Track Group.
function entityToMetaTrackGroup(entity: TrackEntity): protos.MetaTrackGroup {
  if (!(Datastore.KEY in entity)) {
    throw new Error('An ID is required');
  }

  entity = unzipEntity(entity);

  const id = Number(entity[Datastore.KEY]?.id ?? -1);

  return {
    id,
    numPostprocess: entity.num_postprocess ?? 0,
    trackGroupBin: entity.track_group ? new Uint8Array(entity.track_group) : undefined,
    groundAltitudeGroupBin: entity.ground_altitude_group ? new Uint8Array(entity.ground_altitude_group) : undefined,
    airspacesGroupBin: entity.airspaces_group ? new Uint8Array(entity.airspaces_group) : undefined,
  };
}

function zipOrUndefined(buffer: ArrayBuffer | undefined): Buffer | undefined {
  return buffer == null ? undefined : zlib.gzipSync(buffer, { level: 9 });
}

function unzipOrUndefined(buffer: ArrayBuffer | undefined): Buffer | undefined {
  return buffer == null ? undefined : zlib.gunzipSync(buffer);
}

// Expands entity gzipped fields.
function unzipEntity(track: TrackEntity): TrackEntity {
  return {
    ...track,
    airspaces_group: unzipOrUndefined(track.airspaces_group),
    track_group: unzipOrUndefined(track.track_group),
    ground_altitude_group: unzipOrUndefined(track.ground_altitude_group),
  };
}
