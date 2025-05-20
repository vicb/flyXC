import fs from 'node:fs';
import path from 'node:path';

import { TZDate } from '@date-fns/tz';
import { VectorTile } from 'mapbox-vector-tile';

import {
  airspaceOverrides,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  Class,
  getAirspaceTileUrl,
  toTypedAirspace,
  Type,
} from './airspaces';
import { fetchResponse } from './fetch-timeout';

async function getTile(x: number, y: number, z: number): Promise<Map<string, AirspaceTyped>> {
  const airspaces = new Map<string, AirspaceTyped>();
  let buffer: ArrayBuffer;

  const filename = path.join(__dirname, '../../../..', `apps/fxc-tiles/src/assets/airspaces/tiles/${z}/${x}/${y}.pbf`);
  if (fs.existsSync(filename)) {
    buffer = fs.readFileSync(filename);
  } else {
    const url = getAirspaceTileUrl(x, y, z, 'cloud');
    const response = await fetchResponse(url);
    if (!response.ok) {
      throw new Error(`Error reading the tile ${url}`);
    }
    buffer = await response.arrayBuffer();
  }

  const aspLayer = new VectorTile(new Uint8Array(buffer)).layers.asp;
  for (let i = 0; i < aspLayer.length; i++) {
    const feature = aspLayer.feature(i);
    const airspace = toTypedAirspace(feature.properties as AirspaceString);
    airspaces.set(airspace.name, airspace);
  }

  // Help retrieve names
  // console.log(
  //   [...airspaces.keys()].toSorted().filter((n) => {
  //     const nU = n.toUpperCase();
  //     return (
  //       nU.includes('ECRINS') ||
  //       nU.includes('R30B') ||
  //       nU.includes('CLERMONT') ||
  //       nU.includes('CHAMBERY') ||
  //       nU.includes('AIGUILLES')
  //     );
  //   }),
  // );

  return airspaces;
}

describe('Airspace overrides', () => {
  let airspaces: Map<string, AirspaceTyped>;

  beforeAll(async () => {
    airspaces = await getTile(16, 11, 5);
  });

  it('contains all the airspaces', async () => {
    expect(airspaces.get(airspaceOverrides.ecrins)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'GND',
      floorM: 0,
      floorRefGnd: true,
      icaoClass: 8,
      topLabel: '3281ft GND',
      topM: 1000,
      topRefGnd: true,
      type: 29,
    });
    expect(airspaces.get(airspaceOverrides.TMAClermont21)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: '2700ft MSL',
      floorM: 823,
      floorRefGnd: false,
      topRefGnd: false,
    });
    expect(airspaces.get(airspaceOverrides.TMAClermont22)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: '2700ft MSL',
      floorM: 823,
      floorRefGnd: false,
      topRefGnd: false,
    });
    expect(airspaces.get(airspaceOverrides.TMAClermont23)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: '2700ft MSL',
      floorM: 823,
      floorRefGnd: false,
      topRefGnd: false,
    });
    expect(airspaces.get(airspaceOverrides.TMAClermont41)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'FL 65',
      floorM: 1981,
      floorRefGnd: false,
      topRefGnd: false,
    });
    expect(airspaces.get(airspaceOverrides.TMAClermont51)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'FL 85',
      floorM: 2591,
      floorRefGnd: false,
      topRefGnd: false,
    });
    expect(airspaces.get(airspaceOverrides.LFR30B)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'GND',
      floorM: 0,
      floorRefGnd: true,
      icaoClass: 8,
      topLabel: 'FL 115',
      topM: 3505,
      topRefGnd: false,
      type: 1,
    });
    expect(airspaces.get(airspaceOverrides.TMAChambery1)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: '3000ft MSL',
      floorM: 914,
      floorRefGnd: false,
      topLabel: 'FL 95',
      topM: 2896,
      topRefGnd: false,
      type: 7,
    });
    expect(airspaces.get(airspaceOverrides.TMAChambery2)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: '5500ft MSL',
      floorM: 1676,
      floorRefGnd: false,
      topLabel: 'FL 95',
      topM: 2896,
      topRefGnd: false,
      type: 7,
    });
    expect(airspaces.get(airspaceOverrides.TMAChambery3)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'FL 95',
      floorM: 2896,
      floorRefGnd: false,
      topLabel: 'FL 115',
      topM: 3505,
      topRefGnd: false,
      type: 7,
    });
    expect(airspaces.get(airspaceOverrides.CTRChambery2)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'GND',
      floorM: 0,
      floorRefGnd: true,
      icaoClass: 3,
      type: 4,
    });
    expect(airspaces.get(airspaceOverrides.aiguilleRouges)).toMatchObject({
      activity: 0,
      country: 'FR',
      floorLabel: 'GND',
      floorM: 0,
      floorRefGnd: true,
      icaoClass: 8,
      topLabel: '3281ft GND',
      topM: 1000,
      topRefGnd: true,
      type: 29,
    });
  });

  test(airspaceOverrides.aiguilleRouges, () => {
    const aiguillesRouges = airspaces.get(airspaceOverrides.aiguilleRouges)!;
    const override = applyOverrides(aiguillesRouges, new TZDate('2024-07-01', 'Europe/Paris'));

    expect(override).toMatchObject({
      topM: 300,
      topLabel: '984ft GND',
    });
  });

  test(airspaceOverrides.ecrins, () => {
    const ecrins = airspaces.get(airspaceOverrides.ecrins)!;

    expect(applyOverrides(ecrins, new TZDate('2024-01-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-06-30', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-11-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-12-31', 'Europe/Paris'))).toEqual(ecrins);

    expect(applyOverrides(ecrins, new TZDate('2024-07-01', 'Europe/Paris')).type).toEqual(Type.Other);
    expect(applyOverrides(ecrins, new TZDate('2024-10-31', 'Europe/Paris')).type).toEqual(Type.Other);
  });

  test(airspaceOverrides.TMAClermont21, () => {
    const clermont21 = airspaces.get(airspaceOverrides.TMAClermont21)!;

    expect(applyOverrides(clermont21, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyOverrides(clermont21, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont21, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
  });

  test(airspaceOverrides.TMAClermont22, () => {
    const clermont22 = airspaces.get(airspaceOverrides.TMAClermont22)!;

    expect(applyOverrides(clermont22, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyOverrides(clermont22, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont22, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
  });

  test(airspaceOverrides.TMAClermont23, () => {
    const clermont23 = airspaces.get(airspaceOverrides.TMAClermont23)!;

    expect(applyOverrides(clermont23, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont23, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont23, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont23, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    // 2024-03-15 is a Friday
    expect(applyOverrides(clermont23, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont23, new TZDate('2024-03-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont23, new TZDate('2024-03-17', 'Europe/Paris')).topM).toEqual(2590);

    // 2024-10-15 is a Tuesday
    expect(applyOverrides(clermont23, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont23, new TZDate('2024-10-13', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont23, new TZDate('2024-10-12', 'Europe/Paris')).topM).toEqual(2590);
  });

  test(airspaceOverrides.TMAClermont41, () => {
    const clermont41 = airspaces.get(airspaceOverrides.TMAClermont41)!;

    expect(applyOverrides(clermont41, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont41, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont41, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont41, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(2590);

    // 2024-03-15 is a Friday
    expect(applyOverrides(clermont41, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont41, new TZDate('2024-03-16', 'Europe/Paris')).topM).toEqual(2895);
    expect(applyOverrides(clermont41, new TZDate('2024-03-17', 'Europe/Paris')).topM).toEqual(2895);

    // 2024-10-15 is a Tuesday
    expect(applyOverrides(clermont41, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont41, new TZDate('2024-10-13', 'Europe/Paris')).topM).toEqual(2895);
    expect(applyOverrides(clermont41, new TZDate('2024-10-12', 'Europe/Paris')).topM).toEqual(2895);
  });

  test(airspaceOverrides.TMAClermont51, () => {
    const clermont51 = airspaces.get(airspaceOverrides.TMAClermont51)!;

    expect(applyOverrides(clermont51, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(2590);

    expect(applyOverrides(clermont51, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(3505);
    expect(applyOverrides(clermont51, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(3505);
  });

  test(airspaceOverrides.LFR30B, () => {
    const r30b = airspaces.get(airspaceOverrides.LFR30B)!;

    expect(applyOverrides(r30b, new TZDate('2024-01-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-06-30', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-09-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-12-31', 'Europe/Paris'))).not.toEqual(r30b);

    expect(applyOverrides(r30b, new TZDate('2024-07-01', 'Europe/Paris'))).toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-08-31', 'Europe/Paris'))).toEqual(r30b);
  });

  test('TMA CHAMBERY', () => {
    for (const tmaName of [
      airspaceOverrides.TMAChambery1,
      airspaceOverrides.TMAChambery2,
      airspaceOverrides.TMAChambery3,
    ]) {
      const tma = airspaces.get(tmaName)!;
      // openaip has class E
      tma.icaoClass = Class.D;

      // E from 2nd Monday of April to 2nd Friday of December
      expect(applyOverrides(tma, new TZDate('2025-04-14', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyOverrides(tma, new TZDate('2025-12-12', 'Europe/Paris'))).not.toEqual(tma);

      // E from from Monday 11UTC to Thursday 23:59UTC
      expect(applyOverrides(tma, new TZDate('2025-04-13', 'Europe/Paris'))).toEqual(tma);
      expect(applyOverrides(tma, new TZDate('2025-12-13', 'Europe/Paris'))).toEqual(tma);
      // Tuesday -> Thursday
      expect(applyOverrides(tma, new TZDate('2025-04-08', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyOverrides(tma, new TZDate('2025-04-09', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyOverrides(tma, new TZDate('2025-04-10', 'Europe/Paris'))).not.toEqual(tma);
    }
  });

  test(airspaceOverrides.CTRChambery2, () => {
    const ctr = airspaces.get(airspaceOverrides.CTRChambery2)!;

    // E from 2nd Monday of April to 2nd Friday of December
    expect(applyOverrides(ctr, new TZDate('2025-04-14', 'Europe/Paris'))).not.toEqual(ctr);
    expect(applyOverrides(ctr, new TZDate('2025-12-12', 'Europe/Paris'))).not.toEqual(ctr);

    // E from from Monday 11UTC to Thursday 23:59UTC
    expect(applyOverrides(ctr, new TZDate('2025-04-13', 'Europe/Paris'))).toEqual(ctr);
    expect(applyOverrides(ctr, new TZDate('2025-12-13', 'Europe/Paris'))).toEqual(ctr);
    // Tuesday -> Thursday
    expect(applyOverrides(ctr, new TZDate('2025-04-08', 'Europe/Paris'))).not.toEqual(ctr);
    expect(applyOverrides(ctr, new TZDate('2025-04-09', 'Europe/Paris'))).not.toEqual(ctr);
    expect(applyOverrides(ctr, new TZDate('2025-04-10', 'Europe/Paris'))).not.toEqual(ctr);
  });
});
