/* eslint-enable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
/* eslint-disable @typescript-eslint/no-var-requires */

import async from 'async';
import Pbf from 'pbf';

import { fetchAirspaces } from '../run/src/process/airspace';
import { retrieveTrackById, saveTrack, TrackEntity } from './datastore';
import {
  diffDecodeArray,
  diffDecodeTrack,
  diffEncodeAirspaces,
  ProtoAirspaces,
  ProtoGroundAltitude,
  ProtoGroundAltitudeGroup,
  ProtoTrack,
  ProtoTrackGroup,
} from './track';
import * as protos from './track_proto.js';

const BATCH_SIZE = 300;

async function addAirspaces(trackEntity: TrackEntity) {
  let migrated = false;
  const trackGroupBin = trackEntity.track_group;
  const gndAltGroupBin = trackEntity.ground_altitude_group;
  const aspGroupBin = trackEntity.airspaces_group;

  if (trackGroupBin && gndAltGroupBin && !aspGroupBin) {
    // Retrieve the tracks.
    const trackGroup: ProtoTrackGroup = (protos.TrackGroup as any).read(new Pbf(trackGroupBin));
    const tracks: ProtoTrack[] = trackGroup.tracks.map(diffDecodeTrack);

    const gndAltGroup: ProtoGroundAltitudeGroup = (protos.GroundAltitudeGroup as any).read(new Pbf(gndAltGroupBin));
    const gndAlts: ProtoGroundAltitude[] = gndAltGroup.ground_altitudes.map((g) => ({
      altitudes: diffDecodeArray(g.altitudes, 1),
      has_errors: g.has_errors,
    }));

    // Add airspaces.
    const airspaces: ProtoAirspaces[] = [];
    await async.eachOfSeries(tracks, async (track, i) => {
      airspaces.push(await fetchAirspaces(track, gndAlts[Number(i)]));
    });
    const pbf = new Pbf();
    (protos.AirspacesGroup as any).write({ airspaces: airspaces.map(diffEncodeAirspaces) }, pbf);
    trackEntity.airspaces_group = Buffer.from(pbf.finish());
    migrated = true;
  }

  if ((trackEntity as any).data) {
    delete (trackEntity as any).data;
    migrated = true;
  }

  return migrated;
}

// Add airspaces to the tracks.
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
      if (trackEntity) {
        console.log(`migrating id: ${id} hash: ${trackEntity.hash} (${numMigrated} tracks migrated)`);
        const migrated = await addAirspaces(trackEntity);
        if (migrated) {
          numMigrated++;
          await saveTrack(trackEntity);
        }
      }
    });
  }
}
