import {
  diffDecodeArray,
  diffDecodeTrack,
  diffEncodeAirspaces,
  LiveTrackEntity,
  protos,
  trackerNames,
} from '@flyxc/common';
import { getDatastore, retrieveTrackById, TrackEntity, updateUnzippedTracks } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import { RunQueryResponse } from '@google-cloud/datastore/build/src/query';
import { fetchAirspaces } from './airspace';

const datastore = getDatastore();

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

    await updateUnzippedTracks(datastore, entities);

    start = res[1].endCursor;
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);
}

export async function migrateTrack(id: number): Promise<TrackEntity | undefined> {
  const entity = await retrieveTrackById(datastore, id);

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

// Add updated to LiveTrack entities
export async function migrateAddUpdated(): Promise<void> {
  let start: string | undefined;
  let res: RunQueryResponse | undefined;
  const batchSize = 50;
  let count = 0;
  const updated = new Date();

  do {
    const query = datastore.createQuery('LiveTrack').limit(batchSize);
    const entities: LiveTrackEntity[] = [];

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);

    for (const entity of res[0]) {
      console.log(`${count++} id=${entity[Datastore.KEY].id}`);
      try {
        entity.updated = updated;
        entities.push(entity);
      } catch (e) {
        console.error(`migration error ${entity[Datastore.KEY].id}`);
      }
    }

    console.log(`Retrieved ${entities.length} entities`);

    const updates: unknown[] = [];

    for (const entity of entities) {
      const key = entity[Datastore.KEY];

      if (key == null) {
        continue;
      }

      updates.push({
        key,
        excludeFromIndexes: ['track'],
        data: entity,
      });
    }

    console.log(`Prepared ${updates.length} updates`);

    try {
      await datastore.save(updates);
      console.log(`Update successful`);
    } catch (e) {
      console.error(`Update failed ${e}`);
    }

    start = res[1].endCursor;
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);
}

// Add updated to LiveTrack entities
export async function migrateFlyme(): Promise<void> {
  let start: string | undefined;
  let res: RunQueryResponse | undefined;
  const batchSize = 50;

  do {
    const query = datastore.createQuery('LiveTrack').limit(batchSize);
    const entities: LiveTrackEntity[] = [];

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);

    for (const entity of res[0]) {
      try {
        const flyme = entity?.flyme;
        if (flyme && 'account_resolved' in flyme) {
          console.log(`-\n${JSON.stringify(flyme)}`);
          if (flyme.account_resolved === undefined) {
            delete flyme.account_resolved;
          } else {
            flyme.account_resolved = String(flyme.account_resolved);
          }
          console.log(`+\n${JSON.stringify(flyme)}\n`);

          entities.push(entity);
        }
      } catch (e) {
        console.error(`migration error ${entity[Datastore.KEY].id}`);
      }
    }

    console.log(`Updated ${entities.length} entities`);

    const updates: unknown[] = [];

    for (const entity of entities) {
      const key = entity[Datastore.KEY];

      if (key == null) {
        continue;
      }

      updates.push({
        key,
        excludeFromIndexes: ['track'],
        data: entity,
      });
    }

    console.log(`Prepared ${updates.length} updates`);

    try {
      await datastore.save(updates);
      console.log(`Update successful`);
    } catch (e) {
      console.error(`Update failed ${e}`);
    }

    start = res[1].endCursor;
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);
}

// Remove old properties from livetrack
export async function migrateToFetcher(): Promise<void> {
  let start: string | undefined;
  let res: RunQueryResponse | undefined;
  const batchSize = 50;

  do {
    const query = datastore.createQuery('LiveTrack').limit(batchSize);
    const entities: LiveTrackEntity[] = [];

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);

    for (const entity of res[0]) {
      try {
        delete entity.track;
        delete entity.last_fix_sec;
        for (const trackerName of trackerNames) {
          const tracker = entity[trackerName];
          if (!tracker) {
            continue;
          }
          delete tracker.errors_requests;
          delete tracker.updated;
        }
        entities.push(entity);
      } catch (e) {
        console.error(`migration error ${entity[Datastore.KEY].id}`);
      }
    }

    console.log(`Updated ${entities.length} entities`);

    const updates: unknown[] = [];

    for (const entity of entities) {
      const key = entity[Datastore.KEY];

      if (key == null) {
        continue;
      }

      updates.push({
        key,
        excludeFromIndexes: ['track'],
        data: entity,
      });
    }

    console.log(`Prepared ${updates.length} updates`);

    try {
      await datastore.save(updates);
      console.log(`Update successful`);
    } catch (e) {
      console.error(`Update failed ${e}`);
    }

    start = res[1].endCursor;
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);
}
