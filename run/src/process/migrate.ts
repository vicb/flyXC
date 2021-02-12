import * as protos from 'flyxc/common/protos/track';
import { diffDecodeArray } from 'flyxc/common/src/math';
import { diffDecodeTrack, diffEncodeAirspaces } from 'flyxc/common/src/runtime-track';
import { retrieveTrackById, TrackEntity, updateUnzippedTracks } from 'flyxc/common/src/track-entity';

import { Datastore } from '@google-cloud/datastore';
import { RunQueryResponse } from '@google-cloud/datastore/build/src/query';

import { fetchAirspaces } from './airspace';

const datastore = new Datastore();

export async function migrate(): Promise<void> {
  let start: string | undefined;
  let res: RunQueryResponse | undefined;
  const batchSize = 500;
  let count = 0;

  do {
    const query = datastore.createQuery('Track').select('__key__').limit(batchSize);
    const entities: TrackEntity[] = [];

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);

    for (const entity of res[0]) {
      console.log(`${count++} id=${entity[Datastore.KEY].id}`);
      try {
        const migEntity = await migrateTrack(entity[Datastore.KEY].id);
        if (migEntity) {
          entities.push(migEntity);
        }
      } catch (e) {
        console.error(`migration error ${entity[Datastore.KEY].id}`);
      }
    }

    await updateUnzippedTracks(entities);

    start = res[1].endCursor;
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);
}

export async function migrateTrack(id: number): Promise<TrackEntity | undefined> {
  const entity = await retrieveTrackById(id);

  if (!entity) {
    console.error(`No entity`);
    return;
  }

  if (entity.ground_altitude_group == null) {
    console.error('missing ground_altitude_group');
    return;
  }

  if (entity.track_group == null) {
    console.error('missing track_group');
    return;
  }

  if (entity.airspaces_group == null) {
    console.error('missing airspaces_group');
    return;
  }

  const airspaceGroup = protos.AirspacesGroup.fromBinary(entity.airspaces_group);
  const asp = airspaceGroup.airspaces[0];
  if (!asp || asp.bottom.length === 0) {
    return;
  }

  const altGroup = protos.GroundAltitudeGroup.fromBinary(entity.ground_altitude_group);
  const trackGroup = protos.TrackGroup.fromBinary(entity.track_group);

  const airspaces: protos.Airspaces[] = [];
  const numTracks = trackGroup.tracks.length;

  for (let i = 0; i < numTracks; i++) {
    const track = diffDecodeTrack(trackGroup.tracks[i]);
    altGroup.groundAltitudes[i].altitudes = diffDecodeArray(altGroup.groundAltitudes[i].altitudes, 1);
    const asp = await fetchAirspaces(track, altGroup.groundAltitudes[i]);
    airspaces.push(asp);
  }

  entity.airspaces_group = Buffer.from(
    protos.AirspacesGroup.toBinary({ airspaces: airspaces.map(diffEncodeAirspaces) }),
  );

  return entity;
}
