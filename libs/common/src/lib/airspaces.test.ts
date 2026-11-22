import fs from 'node:fs';
import path from 'node:path';

import { TZDate } from '@date-fns/tz';
import { VectorTile } from 'mapbox-vector-tile';

import {
  Activity,
  AIRSPACE_3D_TILE_ZOOM,
  AIRSPACE_OVERRIDE_ID_TO_NAME,
  AIRSPACE_OVERRIDE_KEY_TO_ID,
  AIRSPACE_OVERRIDE_NAME_TO_ID,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  Class,
  CLOUD_AIRSPACE_BASE_URL,
  getAirspace3dTileUrl,
  getAirspaceDateUrl,
  getAirspaceOverrides,
  getAirspaceTilesBaseUrl,
  getAirspaceTileUrl,
  isInFeature,
  LOCAL_AIRSPACE_BASE_URL,
  RESERVED_AIRSPACE_ID_MAX,
  toTypedAirspace,
  Type,
} from './airspaces';
import { fetchResponse } from './fetch-timeout';

async function getTile(x: number, y: number, z: number): Promise<Map<string, AirspaceTyped>> {
  const airspaces = new Map<string, AirspaceTyped>();
  let buffer: Buffer;

  // `__dirname` is `base/libs/common/src/lib`
  // We want to get `base/apps/fxc-tiles/assets/tiles/{z}/{x}/{y}.pbf`
  const filename = path.join(__dirname, '../../../..', `apps/fxc-tiles/assets/tiles/${z}/${x}/${y}.pbf`);
  if (fs.existsSync(filename)) {
    buffer = fs.readFileSync(filename);
  } else {
    const url = getAirspaceTileUrl(x, y, z, 'cloud');
    const response = await fetchResponse(url);
    if (!response.ok) {
      throw new Error(`Error reading the tile ${url}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
  }

  const aspLayer = new VectorTile(new Uint8Array(buffer)).layers.asp;
  for (let i = 0; i < aspLayer.length; i++) {
    const feature = aspLayer.feature(i);
    const airspace = toTypedAirspace(feature.properties as AirspaceString, feature.id);
    const overrideId =
      AIRSPACE_OVERRIDE_KEY_TO_ID[`${airspace.name}|${airspace.icaoClass}`] ??
      AIRSPACE_OVERRIDE_NAME_TO_ID[airspace.name];
    if (overrideId != null) {
      airspace.id = overrideId;
    }
    airspaces.set(airspace.name, airspace);
  }

  return airspaces;
}

describe('Airspace overrides', () => {
  let airspaces: Map<string, AirspaceTyped>;

  beforeAll(async () => {
    airspaces = await getTile(16, 11, 5);
  });

  test('PARC/RESERVE ECRINS', () => {
    const ecrins = airspaces.get('PARC/RESERVE ECRINS')!;

    expect(applyOverrides(ecrins, new TZDate('2024-01-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-06-30', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-11-01', 'Europe/Paris'))).toEqual(ecrins);
    expect(applyOverrides(ecrins, new TZDate('2024-12-31', 'Europe/Paris'))).toEqual(ecrins);

    expect(applyOverrides(ecrins, new TZDate('2024-07-01', 'Europe/Paris')).type).toEqual(Type.Other);
    expect(applyOverrides(ecrins, new TZDate('2024-10-31', 'Europe/Paris')).type).toEqual(Type.Other);
  });

  test('TMA CLERMONT 2.1 (VOL LIBRE)', () => {
    const clermont21 = airspaces.get('TMA CLERMONT 2.1 (VOL LIBRE)')!;

    expect(applyOverrides(clermont21, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont21, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyOverrides(clermont21, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont21, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
  });

  test('TMA CLERMONT 2.2 CHAMPEIX', () => {
    const clermont22 = airspaces.get('TMA CLERMONT 2.2 CHAMPEIX')!;

    expect(applyOverrides(clermont22, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(1680);
    expect(applyOverrides(clermont22, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(1680);

    expect(applyOverrides(clermont22, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(1980);
    expect(applyOverrides(clermont22, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(1980);
  });

  test('TMA CLERMONT 2.3 ORCINES', () => {
    const clermont23 = airspaces.get('TMA CLERMONT 2.3 ORCINES')!;

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

  test('TMA CLERMONT 4.1 JOB', () => {
    const clermont41 = airspaces.get('TMA CLERMONT 4.1 JOB')!;

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

  test('TMA CLERMONT 5.1 PUY DE DOME', () => {
    const clermont51 = airspaces.get('TMA CLERMONT 5.1 PUY DE DOME')!;

    expect(applyOverrides(clermont51, new TZDate('2024-01-01', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-03-14', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-10-16', 'Europe/Paris')).topM).toEqual(2590);
    expect(applyOverrides(clermont51, new TZDate('2024-12-31', 'Europe/Paris')).topM).toEqual(2590);

    expect(applyOverrides(clermont51, new TZDate('2024-03-15', 'Europe/Paris')).topM).toEqual(3505);
    expect(applyOverrides(clermont51, new TZDate('2024-10-15', 'Europe/Paris')).topM).toEqual(3505);
  });

  test('LF-R30A MONT BLANC', () => {
    const r30a = airspaces.get('LF-R30A MONT BLANC')!;

    expect(applyOverrides(r30a, new TZDate('2024-01-01', 'Europe/Paris'))).toEqual(r30a);
    expect(applyOverrides(r30a, new TZDate('2024-06-30', 'Europe/Paris'))).toEqual(r30a);
    expect(applyOverrides(r30a, new TZDate('2024-09-01', 'Europe/Paris'))).toEqual(r30a);
    expect(applyOverrides(r30a, new TZDate('2024-12-31', 'Europe/Paris'))).toEqual(r30a);

    expect(applyOverrides(r30a, new TZDate('2024-07-01', 'Europe/Paris'))).not.toEqual(r30a);
    expect(applyOverrides(r30a, new TZDate('2024-08-31', 'Europe/Paris'))).not.toEqual(r30a);
    expect(applyOverrides(r30a, new TZDate('2024-07-15', 'Europe/Paris')).type).toEqual(Type.Other);
  });

  test('LF-R30B MONT BLANC (JULY+AUG)', () => {
    const r30b = airspaces.get('LF-R30B MONT BLANC (JULY+AUG)')!;

    expect(applyOverrides(r30b, new TZDate('2024-01-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-06-30', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-09-01', 'Europe/Paris'))).not.toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-12-31', 'Europe/Paris'))).not.toEqual(r30b);

    expect(applyOverrides(r30b, new TZDate('2024-07-01', 'Europe/Paris'))).toEqual(r30b);
    expect(applyOverrides(r30b, new TZDate('2024-08-31', 'Europe/Paris'))).toEqual(r30b);
  });

  test('LF-R30C MONT BLANC (JUNE - 15 OCT)', () => {
    const r30c = airspaces.get('LF-R30C MONT BLANC (JUNE - 15 OCT)')!;

    // Inactive outside June 1 - Oct 15
    expect(applyOverrides(r30c, new TZDate('2024-01-01', 'Europe/Paris'))).not.toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-05-31', 'Europe/Paris'))).not.toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-10-16', 'Europe/Paris'))).not.toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-12-31', 'Europe/Paris'))).not.toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-10-16', 'Europe/Paris')).type).toEqual(Type.Other);

    // Active June 1 - Oct 15
    expect(applyOverrides(r30c, new TZDate('2024-06-01', 'Europe/Paris'))).toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-07-15', 'Europe/Paris'))).toEqual(r30c);
    expect(applyOverrides(r30c, new TZDate('2024-10-15', 'Europe/Paris'))).toEqual(r30c);
  });

  test('TMA CHAMBERY', () => {
    for (const tmaName of ['TMA CHAMBERY 1', 'TMA CHAMBERY 2', 'TMA CHAMBERY 3']) {
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

  test('CTR CHAMBERY 2 (ACTIVE MID DEC -> MID APRIL)', () => {
    const ctr = airspaces.get('CTR CHAMBERY 2 (ACTIVE MID DEC -> MID APRIL)')!;

    // disabled from 2nd Monday of April to 2nd Friday of December
    expect(applyOverrides(ctr, new TZDate('2025-04-14', 'Europe/Paris')).icaoClass).toEqual(Class.SUA);
    expect(applyOverrides(ctr, new TZDate('2025-12-12', 'Europe/Paris')).icaoClass).toEqual(Class.SUA);

    // disabled from from Monday 11UTC to Thursday 23:59UTC
    expect(applyOverrides(ctr, new TZDate('2025-04-13', 'Europe/Paris')).icaoClass).toEqual(Class.D);
    expect(applyOverrides(ctr, new TZDate('2025-12-13', 'Europe/Paris')).icaoClass).toEqual(Class.D);
    // Tuesday -> Thursday
    expect(applyOverrides(ctr, new TZDate('2025-04-08', 'Europe/Paris')).icaoClass).toEqual(Class.SUA);
    expect(applyOverrides(ctr, new TZDate('2025-04-09', 'Europe/Paris')).icaoClass).toEqual(Class.SUA);
    expect(applyOverrides(ctr, new TZDate('2025-04-10', 'Europe/Paris')).icaoClass).toEqual(Class.SUA);
  });

  test('getAirspaceOverrides reflects active date overrides', () => {
    const july = new TZDate('2025-07-15T12:00:00', 'Europe/Paris');
    const julyMap = getAirspaceOverrides(july);

    expect(julyMap.get(1)).toEqual({
      name: 'PARC/RESERVE ECRINS - INACTIVE',
      type: Type.Other,
    });
    expect(julyMap.get(2)).toMatchObject({
      icaoClass: Class.G,
      type: Type.TMA,
    });
    expect(julyMap.get(7)).toEqual({
      name: 'LF-R30A MONT BLANC - INACTIVE',
      type: Type.Other,
    });
    expect(julyMap.has(8)).toBe(false);
    expect(julyMap.has(9)).toBe(false);
    expect(julyMap.get(10)).toEqual({
      icaoClass: Class.E,
    });
    expect(julyMap.get(13)).toMatchObject({
      icaoClass: Class.SUA,
      type: Type.Other,
    });

    const winterWeekend = new TZDate('2025-04-13T12:00:00', 'Europe/Paris');
    const winterMap = getAirspaceOverrides(winterWeekend);

    expect(winterMap.has(1)).toBe(false);
    expect(winterMap.has(7)).toBe(false);
    expect(winterMap.get(8)).toEqual({
      name: 'LF-R30B MONT BLANC (JULY+AUG) - INACTIVE',
      type: Type.Other,
    });
    expect(winterMap.get(9)).toEqual({
      name: 'LF-R30C MONT BLANC (JUNE - 15 OCT) - INACTIVE',
      type: Type.Other,
    });
    expect(winterMap.get(10)).toEqual({
      icaoClass: Class.D,
    });
    expect(winterMap.get(13)).toMatchObject({
      icaoClass: Class.D,
    });
  });

  describe('isInFeature', () => {
    it('correctly maps feature tile extent and handles holes', () => {
      const feature = {
        extent: 4096,
        asPolygons() {
          return [
            [
              [
                { x: 0, y: 0 },
                { x: 4096, y: 0 },
                { x: 4096, y: 4096 },
                { x: 0, y: 4096 },
                { x: 0, y: 0 },
              ],
              [
                { x: 1024, y: 1024 },
                { x: 3072, y: 1024 },
                { x: 3072, y: 3072 },
                { x: 1024, y: 3072 },
                { x: 1024, y: 1024 },
              ],
            ],
          ];
        },
      } as any;

      // feature.extent is 4096, 256 / 4096 = 1/16
      // point is in 256x256 tile pixels
      // Center (128, 128) maps to (2048, 2048) in feature coords -> inside hole!
      expect(isInFeature({ x: 128, y: 128 }, feature)).toBe(false);
      // (32, 32) maps to (512, 512) in feature coords -> inside outer ring, outside hole
      expect(isInFeature({ x: 32, y: 32 }, feature)).toBe(true);
      // (300, 300) maps to (4800, 4800) -> outside outer ring
      expect(isInFeature({ x: 300, y: 300 }, feature)).toBe(false);
      // (258, 128) is 2 tile-pixels outside the right boundary (x=256)
      expect(isInFeature({ x: 258, y: 128 }, feature)).toBe(false);
      expect(isInFeature({ x: 258, y: 128 }, feature, 3)).toBe(true);
    });

    it('utilizes bbox for fast early rejection', () => {
      let asPolygonsCalled = false;
      const feature = {
        extent: 4096,
        bbox() {
          return [1000, 1000, 2000, 2000];
        },
        asPolygons() {
          asPolygonsCalled = true;
          return [
            [
              [
                { x: 1000, y: 1000 },
                { x: 2000, y: 1000 },
                { x: 2000, y: 2000 },
                { x: 1000, y: 2000 },
                { x: 1000, y: 1000 },
              ],
            ],
          ];
        },
      } as any;

      // (10, 10) maps to px 160 -> outside bbox [1000, 1000, 2000, 2000]
      expect(isInFeature({ x: 10, y: 10 }, feature)).toBe(false);
      expect(asPolygonsCalled).toBe(false);

      // (100, 100) maps to px 1600 -> inside bbox
      expect(isInFeature({ x: 100, y: 100 }, feature)).toBe(true);
      expect(asPolygonsCalled).toBe(true);
    });
  });

  describe('Reserved Override IDs', () => {
    it('provides a bidirectional mapping covering all override airspaces', () => {
      const overrideNames = Object.values(AIRSPACE_OVERRIDE_ID_TO_NAME);
      expect(Object.keys(AIRSPACE_OVERRIDE_ID_TO_NAME)).toHaveLength(overrideNames.length);
      for (const [idStr, name] of Object.entries(AIRSPACE_OVERRIDE_ID_TO_NAME)) {
        const id = Number(idStr);
        expect(id).toBeGreaterThan(0);
        expect(id).toBeLessThanOrEqual(RESERVED_AIRSPACE_ID_MAX);
        expect(overrideNames).toContain(name);
        expect(AIRSPACE_OVERRIDE_NAME_TO_ID[name]).toBe(id);
      }
    });

    it('matches overrides by ID when airspace name is empty (3D tiles)', () => {
      // Feature 8 is LF-R30B Mont Blanc
      const nameless3dFeature: AirspaceTyped = {
        id: 8,
        name: '',
        country: 'FR',
        type: Type.Restricted,
        icaoClass: Class.SUA,
        activity: Activity.None,
        floorM: 0,
        floorLabel: 'GND',
        floorRefGnd: true,
        topM: 3505,
        topLabel: 'FL 115',
        topRefGnd: false,
      };

      // In November: should be overridden to Type.Other (inactive)
      const winterResult = applyOverrides(nameless3dFeature, new TZDate('2026-11-15', 'Europe/Paris'));
      expect(winterResult.type).toBe(Type.Other);
      expect(winterResult.name).toBe('LF-R30B MONT BLANC (JULY+AUG) - INACTIVE');

      // In July: active, no override applies, remains unchanged
      const summerResult = applyOverrides(nameless3dFeature, new TZDate('2026-07-15', 'Europe/Paris'));
      expect(summerResult.type).toBe(Type.Restricted);
      expect(summerResult).toEqual(nameless3dFeature);
    });
  });

  describe('Airspace 3D and Version URLs', () => {
    it('provides correct base URLs', () => {
      expect(getAirspaceTilesBaseUrl('cloud')).toBe(`${CLOUD_AIRSPACE_BASE_URL}/tiles`);
      expect(getAirspaceTilesBaseUrl('local')).toBe(LOCAL_AIRSPACE_BASE_URL);
    });

    it('generates correct date URLs', () => {
      expect(getAirspaceDateUrl('cloud')).toBe('https://airspaces.storage.googleapis.com/airspaces-date.json');
      expect(getAirspaceDateUrl('local')).toBe('http://localhost:8084/airspaces-date.json');
    });

    it('generates correct 3D tile URLs for zoom 6', () => {
      expect(AIRSPACE_3D_TILE_ZOOM).toBe(6);
      expect(getAirspace3dTileUrl(32, 21, 'cloud')).toBe(
        'https://airspaces.storage.googleapis.com/tiles/6/32/21-unclipped.pbf',
      );
      expect(getAirspace3dTileUrl(32, 21, 'local')).toBe('http://localhost:8084/6/32/21-unclipped.pbf');
    });
  });
});
