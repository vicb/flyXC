import fs from 'node:fs';
import path from 'node:path';

import { TZDate } from '@date-fns/tz';
import { VectorTile } from 'mapbox-vector-tile';

import {
  type AirspaceString,
  type AirspaceTyped,
  applyTimeRule,
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
  return airspaces;
}

describe('Time dependent Airspace', () => {
  let airspaces: Map<string, AirspaceTyped>;

  beforeAll(async () => {
    airspaces = await getTile(16, 11, 5);
  });

  it('contains all the airspaces', async () => {
    expect(airspaces.get('PARC/RESERVE  ECRINS 1000M/SOL')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "GND",
        "floorM": 0,
        "floorRefGnd": true,
        "icaoClass": 8,
        "name": "PARC/RESERVE  ECRINS 1000M/SOL",
        "topLabel": "3281ft GND",
        "topM": 1000,
        "topRefGnd": true,
        "type": 29,
      }
    `);
    expect(airspaces.get('TMA CLERMONT 2.1 (VOL LIBRE)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "2700ft MSL",
        "floorM": 823,
        "floorRefGnd": false,
        "icaoClass": 6,
        "name": "TMA CLERMONT 2.1 (VOL LIBRE)",
        "topLabel": "FL 65",
        "topM": 1981,
        "topRefGnd": false,
        "type": 21,
      }
    `);
    expect(airspaces.get('TMA CLERMONT 2.2 CHAMPEIX (VOL LIBRE)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "2700ft MSL",
        "floorM": 823,
        "floorRefGnd": false,
        "icaoClass": 6,
        "name": "TMA CLERMONT 2.2 CHAMPEIX (VOL LIBRE)",
        "topLabel": "FL 110",
        "topM": 3353,
        "topRefGnd": false,
        "type": 21,
      }
    `);
    expect(airspaces.get('TMA CLERMONT 2.3 ORCINES (VOL LIBRE)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "2700ft MSL",
        "floorM": 823,
        "floorRefGnd": false,
        "icaoClass": 6,
        "name": "TMA CLERMONT 2.3 ORCINES (VOL LIBRE)",
        "topLabel": "FL 85",
        "topM": 2591,
        "topRefGnd": false,
        "type": 21,
      }
    `);
    expect(airspaces.get('TMA CLERMONT 4.1 JOB (VOL LIBRE)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "FL 65",
        "floorM": 1981,
        "floorRefGnd": false,
        "icaoClass": 6,
        "name": "TMA CLERMONT 4.1 JOB (VOL LIBRE)",
        "topLabel": "FL 95",
        "topM": 2896,
        "topRefGnd": false,
        "type": 21,
      }
    `);
    expect(airspaces.get('TMA CLERMONT5.1 PUY DE DOME (VOL LIBRE)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "FL 85",
        "floorM": 2591,
        "floorRefGnd": false,
        "icaoClass": 6,
        "name": "TMA CLERMONT5.1 PUY DE DOME (VOL LIBRE)",
        "topLabel": "FL 115",
        "topM": 3505,
        "topRefGnd": false,
        "type": 21,
      }
    `);
    expect(airspaces.get('LF-R30B MONT BLANC (JULY+AUGUST)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "GND",
        "floorM": 0,
        "floorRefGnd": true,
        "icaoClass": 8,
        "name": "LF-R30B MONT BLANC (JULY+AUGUST)",
        "topLabel": "FL 115",
        "topM": 3505,
        "topRefGnd": false,
        "type": 1,
      }
    `);
    expect(airspaces.get('TMA CHAMBERY 1')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "3000ft MSL",
        "floorM": 914,
        "floorRefGnd": false,
        "icaoClass": 4,
        "name": "TMA CHAMBERY 1",
        "topLabel": "FL 95",
        "topM": 2896,
        "topRefGnd": false,
        "type": 7,
      }
    `);
    expect(airspaces.get('TMA CHAMBERY 2')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "5500ft MSL",
        "floorM": 1676,
        "floorRefGnd": false,
        "icaoClass": 4,
        "name": "TMA CHAMBERY 2",
        "topLabel": "FL 95",
        "topM": 2896,
        "topRefGnd": false,
        "type": 7,
      }
    `);
    expect(airspaces.get('TMA CHAMBERY 3')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "FL 95",
        "floorM": 2896,
        "floorRefGnd": false,
        "icaoClass": 4,
        "name": "TMA CHAMBERY 3",
        "topLabel": "FL 115",
        "topM": 3505,
        "topRefGnd": false,
        "type": 7,
      }
    `);
    expect(airspaces.get('CTR CHAMBERY 2 (ACTIVE MID DEC -> MID AVRIL)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "GND",
        "floorM": 0,
        "floorRefGnd": true,
        "icaoClass": 3,
        "name": "CTR CHAMBERY 2 (ACTIVE MID DEC -> MID AVRIL)",
        "topLabel": "3500ft MSL",
        "topM": 1067,
        "topRefGnd": false,
        "type": 4,
      }
    `);
    expect(airspaces.get('CTR CHAMBERY 3 (ACTIVE MID DEC -> MID AVRIL)')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "GND",
        "floorM": 0,
        "floorRefGnd": true,
        "icaoClass": 3,
        "name": "CTR CHAMBERY 3 (ACTIVE MID DEC -> MID AVRIL)",
        "topLabel": "1000ft GND",
        "topM": 305,
        "topRefGnd": true,
        "type": 4,
      }
    `);
    expect(airspaces.get('PARC/RESERVE  AIGUILLES ROUGES 1000M/SOL')).toMatchInlineSnapshot(`
      {
        "activity": 0,
        "country": "FR",
        "floorLabel": "GND",
        "floorM": 0,
        "floorRefGnd": true,
        "icaoClass": 8,
        "name": "PARC/RESERVE  AIGUILLES ROUGES 1000M/SOL",
        "topLabel": "3281ft GND",
        "topM": 1000,
        "topRefGnd": true,
        "type": 29,
      }
    `);
  });

  test('PARC/RESERVE  AIGUILLES ROUGES 1000M/SOL', () => {
    const aiguillesRouges = airspaces.get('PARC/RESERVE  AIGUILLES ROUGES 1000M/SOL')!;
    const override = applyTimeRule(aiguillesRouges, new TZDate('2024-07-01', 'Europe/Paris'));

    expect(override).toMatchObject({
      topM: 300,
      topLabel: '984ft GND',
      name: 'PARC/RESERVE  AIGUILLES ROUGES 300M/SOL',
    });
  });

  test('PARC/RESERVE  ECRINS 1000M/SOL', () => {
    const ecrins = airspaces.get('PARC/RESERVE  ECRINS 1000M/SOL')!;

    expect(applyTimeRule(ecrins, new TZDate('2024-01-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyTimeRule(ecrins, new TZDate('2024-06-30', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyTimeRule(ecrins, new TZDate('2024-11-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyTimeRule(ecrins, new TZDate('2024-12-31', 'Europe/Paris'))).toEqual(ecrins);

    expect(applyTimeRule(ecrins, new TZDate('2024-07-01', 'Europe/Paris')).type).toEqual(Type.Other);
    expect(applyTimeRule(ecrins, new TZDate('2024-10-31', 'Europe/Paris')).type).toEqual(Type.Other);
  });

  test('TMA CLERMONT 2.1 (VOL LIBRE)', () => {
    const clermont21 = airspaces.get('TMA CLERMONT 2.1 (VOL LIBRE)')!;

    expect(applyTimeRule(clermont21, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont21, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont21, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont21, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyTimeRule(clermont21, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1981);
    expect(applyTimeRule(clermont21, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1981);
  });

  test('TMA CLERMONT 2.2 CHAMPEIX (VOL LIBRE)', () => {
    const clermont22 = airspaces.get('TMA CLERMONT 2.2 CHAMPEIX (VOL LIBRE)')!;

    expect(applyTimeRule(clermont22, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont22, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont22, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont22, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyTimeRule(clermont22, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyTimeRule(clermont22, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
  });

  test('TMA CLERMONT 2.3 ORCINES (VOL LIBRE)', () => {
    const clermont23 = airspaces.get('TMA CLERMONT 2.3 ORCINES (VOL LIBRE)')!;

    expect(applyTimeRule(clermont23, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont23, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont23, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyTimeRule(clermont23, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    // 2024-03-15 is a Friday
    expect(applyTimeRule(clermont23, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyTimeRule(clermont23, new TZDate('2024-03-16', 'Europe/Paris')).topM).toEqual(2591);
    expect(applyTimeRule(clermont23, new TZDate('2024-03-17', 'Europe/Paris')).topM).toEqual(2591);

    // 2024-10-15 is a Tuesday
    expect(applyTimeRule(clermont23, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyTimeRule(clermont23, new TZDate('2024-10-13', 'Europe/Paris')).topM).toEqual(2591);
    expect(applyTimeRule(clermont23, new TZDate('2024-10-12', 'Europe/Paris')).topM).toEqual(2591);
  });

  test('TMA CLERMONT 4.1 JOB (VOL LIBRE)', () => {
    const clermont41 = airspaces.get('TMA CLERMONT 4.1 JOB (VOL LIBRE)')!;

    expect(applyTimeRule(clermont41, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont41, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont41, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont41, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(2590);

    // 2024-03-15 is a Friday
    expect(applyTimeRule(clermont41, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont41, new TZDate('2024-03-16', 'Europe/Paris')).topM).toEqual(2896);
    expect(applyTimeRule(clermont41, new TZDate('2024-03-17', 'Europe/Paris')).topM).toEqual(2896);

    // 2024-10-15 is a Tuesday
    expect(applyTimeRule(clermont41, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont41, new TZDate('2024-10-13', 'Europe/Paris')).topM).toEqual(2896);
    expect(applyTimeRule(clermont41, new TZDate('2024-10-12', 'Europe/Paris')).topM).toEqual(2896);
  });

  test('TMA CLERMONT5.1 PUY DE DOME (VOL LIBRE)', () => {
    const clermont51 = airspaces.get('TMA CLERMONT5.1 PUY DE DOME (VOL LIBRE)')!;

    expect(applyTimeRule(clermont51, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont51, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont51, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyTimeRule(clermont51, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(2590);

    expect(applyTimeRule(clermont51, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(3505);
    expect(applyTimeRule(clermont51, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(3505);
  });

  test('LF-R30B MONT BLANC (JULY+AUGUST)', () => {
    const r30b = airspaces.get('LF-R30B MONT BLANC (JULY+AUGUST)')!;

    expect(applyTimeRule(r30b, new TZDate('2024-01-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyTimeRule(r30b, new TZDate('2024-06-30', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyTimeRule(r30b, new TZDate('2024-09-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyTimeRule(r30b, new TZDate('2024-12-31', 'Europe/Paris'))).not.toEqual(r30b);

    expect(applyTimeRule(r30b, new TZDate('2024-07-01', 'Europe/Paris'))).toEqual(r30b);
    expect(applyTimeRule(r30b, new TZDate('2024-08-31', 'Europe/Paris'))).toEqual(r30b);
  });

  test('TMA CHAMBERY', () => {
    for (const tmaName of ['TMA CHAMBERY 1', 'TMA CHAMBERY 2', 'TMA CHAMBERY 3']) {
      const tma = airspaces.get(tmaName)!;
      // openaip has class E
      tma.icaoClass = Class.D;

      // E from 2nd Monday of April to 2nd Friday of December
      expect(applyTimeRule(tma, new TZDate('2025-04-14', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyTimeRule(tma, new TZDate('2025-12-12', 'Europe/Paris'))).not.toEqual(tma);

      // E from from Monday 11UTC to Thursday 23:59UTC
      expect(applyTimeRule(tma, new TZDate('2025-04-13', 'Europe/Paris'))).toEqual(tma);
      expect(applyTimeRule(tma, new TZDate('2025-12-13', 'Europe/Paris'))).toEqual(tma);
      // Tuesday -> Thursday
      expect(applyTimeRule(tma, new TZDate('2025-04-08', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyTimeRule(tma, new TZDate('2025-04-09', 'Europe/Paris'))).not.toEqual(tma);
      expect(applyTimeRule(tma, new TZDate('2025-04-10', 'Europe/Paris'))).not.toEqual(tma);
    }
  });

  test('CTR CHAMBERY', () => {
    for (const ctrName of [
      'CTR CHAMBERY 2 (ACTIVE MID DEC -> MID AVRIL)',
      'CTR CHAMBERY 3 (ACTIVE MID DEC -> MID AVRIL)',
    ]) {
      const ctr = airspaces.get(ctrName)!;

      // E from 2nd Monday of April to 2nd Friday of December
      expect(applyTimeRule(ctr, new TZDate('2025-04-14', 'Europe/Paris'))).not.toEqual(ctr);
      expect(applyTimeRule(ctr, new TZDate('2025-12-12', 'Europe/Paris'))).not.toEqual(ctr);

      // E from from Monday 11UTC to Thursday 23:59UTC
      expect(applyTimeRule(ctr, new TZDate('2025-04-13', 'Europe/Paris'))).toEqual(ctr);
      expect(applyTimeRule(ctr, new TZDate('2025-12-13', 'Europe/Paris'))).toEqual(ctr);
      // Tuesday -> Thursday
      expect(applyTimeRule(ctr, new TZDate('2025-04-08', 'Europe/Paris'))).not.toEqual(ctr);
      expect(applyTimeRule(ctr, new TZDate('2025-04-09', 'Europe/Paris'))).not.toEqual(ctr);
      expect(applyTimeRule(ctr, new TZDate('2025-04-10', 'Europe/Paris'))).not.toEqual(ctr);
    }
  });
});
