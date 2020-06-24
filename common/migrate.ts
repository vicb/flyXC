/* eslint-enable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
/* eslint-disable @typescript-eslint/no-var-requires */

import async from 'async';
import Pbf from 'pbf';

import { postProcessTrack } from '../run/src/process/process';
import { retrieveTrackById, saveTrack, TrackEntity } from './datastore';
import { ProtoTrack } from './track';
import * as protos from './track_proto.js';

const BATCH_SIZE = 300;

export interface LegacyFix {
  lat: number;
  lon: number;
  alt: number;
  ts: number;
}

export interface LegacyTrack {
  fixes: LegacyFix[];
  pilot: string;
}

function populateNewFields(entity: TrackEntity): boolean {
  if (!entity.data) {
    console.error('No data field on the entity');
    return true;
  }

  if (entity.track_group) {
    // Already migrated
    return false;
  }

  const legacyTracks: LegacyTrack[] = JSON.parse(entity.data.toString());

  const newTracks: ProtoTrack[] = legacyTracks.map((legacyTrack) => {
    const lat: number[] = [];
    const lon: number[] = [];
    const alt: number[] = [];
    const ts: number[] = [];

    // The legacy track is already differential encoded.
    legacyTrack.fixes.forEach((f) => {
      lat.push(f.lat);
      lon.push(f.lon);
      alt.push(f.alt);
      ts.push(f.ts);
    });

    return {
      pilot: legacyTrack.pilot,
      lat,
      lon,
      alt,
      ts,
    };
  });

  const pbf = new Pbf();
  (protos.TrackGroup as any).write({ tracks: newTracks }, pbf);
  const track_group_bin = Buffer.from(pbf.finish());

  entity.track_group = track_group_bin;

  return true;
}

// Migrate legacy format (JSON data field) to the new format.
export async function migrate(): Promise<void> {
  console.log('Migrate');
  const datastore = new Datastore();

  let token: string | undefined;

  let query = datastore.createQuery('Track').select('__key__').limit(BATCH_SIZE);
  let numMigrated = 0;
  let numBatches = 0;

  while (true) {
    console.log(`Processing batch #${numBatches} (${numBatches * BATCH_SIZE} tracks).`);
    numBatches++;
    if (token != null) {
      query = query.start(token);
    }
    const [entities, info] = await datastore.runQuery(query);
    if (entities.length == 0 || info.moreResults == Datastore.NO_MORE_RESULTS) {
      break;
    }
    token = info.endCursor;
    await async.eachLimit(entities, 10, async (entity: any) => {
      const id = entity[datastore.KEY].id;
      const trackEntity = await retrieveTrackById(id);
      if (trackEntity && populateNewFields(trackEntity)) {
        console.log(` - migrating id: ${id} hash: ${trackEntity.hash} (${numMigrated++} tracks migrated)`);
        await saveTrack(trackEntity);
        await postProcessTrack(id);
      }
    });
  }
}
