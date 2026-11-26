import { open } from 'node:fs/promises';
import path from 'node:path';

import { TZDate } from '@date-fns/tz';
import { VectorTile } from 'mapbox-vector-tile';

import {
  Activity,
  AIRSPACE_3D_TILE_ZOOM,
  AIRSPACE_OVERRIDE_ID_TO_NAME,
  AIRSPACE_OVERRIDE_KEY_TO_ID,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  Class,
  CLOUD_AIRSPACE_BASE_URL,
  getAirspace3dPmtilesUrl,
  getAirspaceOverrides,
  getAirspacePmtilesUrl,
  isInFeature,
  isPointInFeatureBbox,
  isPointInFlatGeometry,
  LOCAL_AIRSPACE_BASE_URL,
  RESERVED_AIRSPACE_ID_MAX,
  toTypedAirspace,
  Type,
} from './airspaces';
import { PMTiles, type PmtilesSource } from './pmtiles';

async function getTile(x: number, y: number, z: number): Promise<Map<string, AirspaceTyped>> {
  const airspaces = new Map<string, AirspaceTyped>();
  const pmtilesFile = path.join(__dirname, 'fixtures/airspaces-test.pmtiles');
  const handle = await open(pmtilesFile, 'r');
  let buffer: Buffer;
  try {
    const source: PmtilesSource = {
      getKey: () => pmtilesFile,
      async getBytes(offset: number, length: number) {
        const buf = Buffer.allocUnsafe(length);
        const { bytesRead } = await handle.read(buf, 0, length, offset);
        return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead) };
      },
    };
    const res = await new PMTiles(source).getZxy(z, x, y);
    if (!res) {
      throw new Error(`Tile ${z}/${x}/${y} not found in ${pmtilesFile}`);
    }
    buffer = Buffer.from(res.data);
  } finally {
    await handle.close();
  }

  const aspLayer = new VectorTile(new Uint8Array(buffer)).layers.asp;
  for (let i = 0; i < aspLayer.length; i++) {
    const feature = aspLayer.feature(i);
    const airspace = toTypedAirspace(feature.properties as AirspaceString, feature.id);
    const overrideId = AIRSPACE_OVERRIDE_KEY_TO_ID[`${airspace.name}|${airspace.icaoClass}`];
    if (overrideId != null) {
      airspace.id = overrideId;
      airspaces.set(airspace.name, airspace);
    } else if (!airspaces.has(airspace.name)) {
      airspaces.set(airspace.name, airspace);
    }
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
        bbox() {
          return [0, 0, 4096, 4096];
        },
        loadFlatGeometry() {
          return {
            coords: [
              // Outer ring
              0, 0, 4096, 0, 4096, 4096, 0, 4096, 0, 0,
              // Hole ring (CCW in MVT y-down coords)
              1024, 1024, 1024, 3072, 3072, 3072, 3072, 1024, 1024, 1024,
            ],
            ends: [10, 20],
          };
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
      let loadFlatGeometryCalled = false;
      const feature = {
        extent: 4096,
        bbox() {
          return [1000, 1000, 2000, 2000];
        },
        loadFlatGeometry() {
          loadFlatGeometryCalled = true;
          return {
            coords: [1000, 1000, 2000, 1000, 2000, 2000, 1000, 2000, 1000, 1000],
            ends: [10],
          };
        },
      } as any;

      // (10, 10) maps to px 160 -> outside bbox [1000, 1000, 2000, 2000]
      expect(isInFeature({ x: 10, y: 10 }, feature)).toBe(false);
      expect(loadFlatGeometryCalled).toBe(false);

      // (100, 100) maps to px 1600 -> inside bbox
      expect(isInFeature({ x: 100, y: 100 }, feature)).toBe(true);
      expect(loadFlatGeometryCalled).toBe(true);
    });
  });

  describe('isPointInFeatureBbox and isPointInFlatGeometry', () => {
    const feature = {
      extent: 4096,
      bbox() {
        return [1000, 1000, 2000, 2000];
      },
    } as any;

    const coords = new Float64Array([1000, 1000, 2000, 1000, 2000, 2000, 1000, 2000, 1000, 1000]);
    const ends = new Uint32Array([10]);

    it('correctly tests bounding box with and without margin', () => {
      // 100 in 256px -> 1600 in 4096px -> inside [1000, 1000, 2000, 2000]
      expect(isPointInFeatureBbox({ x: 100, y: 100 }, feature)).toBe(true);
      // 10 in 256px -> 160 in 4096px -> outside
      expect(isPointInFeatureBbox({ x: 10, y: 10 }, feature)).toBe(false);
      // 60 in 256px -> 960 in 4096px -> within 3px margin (48px in 4096)
      expect(isPointInFeatureBbox({ x: 60, y: 100 }, feature, 3)).toBe(true);
    });

    it('correctly tests point in flat geometry', () => {
      // Inside point (100 in 256px -> 1600 in 4096)
      expect(isPointInFlatGeometry({ x: 100, y: 100 }, coords, ends, 4096)).toBe(true);
      expect(isPointInFlatGeometry({ x: 100, y: 100 }, coords, ends, 4096, 3)).toBe(true);
      // Outside point (10 in 256px -> 160 in 4096)
      expect(isPointInFlatGeometry({ x: 10, y: 10 }, coords, ends, 4096)).toBe(false);
      expect(isPointInFlatGeometry({ x: 10, y: 10 }, coords, ends, 4096, 3)).toBe(false);
      // Point outside by 2.5px (60 in 256px -> 960 in 4096, boundary at 1000)
      expect(isPointInFlatGeometry({ x: 60, y: 100 }, coords, ends, 4096, 0)).toBe(false);
      expect(isPointInFlatGeometry({ x: 60, y: 100 }, coords, ends, 4096, 2)).toBe(false);
      expect(isPointInFlatGeometry({ x: 60, y: 100 }, coords, ends, 4096, 3)).toBe(true);
    });

    it('tests all exterior rings and their holes in a multipolygon flat geometry', () => {
      // MVT winding: exterior rings are CW in screen coords (positive shoelace area), holes are CCW (negative)
      // Polygon 1: [500..1000, 500..1000] with hole [600..900, 600..900]
      // Polygon 2: [2000..3000, 2000..3000]
      const multiCoords = new Float64Array([
        // Poly 1 outer (CW in y-down: (500,500) -> (1000,500) -> (1000,1000) -> (500,1000))
        500, 500, 1000, 500, 1000, 1000, 500, 1000, 500, 500,
        // Poly 1 hole (CCW in y-down: (600,600) -> (600,900) -> (900,900) -> (900,600))
        600, 600, 600, 900, 900, 900, 900, 600, 600, 600,
        // Poly 2 outer (CW in y-down: (2000,2000) -> (3000,2000) -> (3000,3000) -> (2000,3000))
        2000, 2000, 3000, 2000, 3000, 3000, 2000, 3000, 2000, 2000,
      ]);
      const multiEnds = new Uint32Array([10, 20, 30]);
      const toPx = (v: number) => (v * 256) / 4096;

      // Inside poly 1 outer, outside hole
      expect(isPointInFlatGeometry({ x: toPx(550), y: toPx(550) }, multiCoords, multiEnds, 4096)).toBe(true);
      // Inside poly 1 hole -> false
      expect(isPointInFlatGeometry({ x: toPx(750), y: toPx(750) }, multiCoords, multiEnds, 4096)).toBe(false);
      // Inside poly 2 outer -> true
      expect(isPointInFlatGeometry({ x: toPx(2500), y: toPx(2500) }, multiCoords, multiEnds, 4096)).toBe(true);
      // Just outside poly 2 by 2.5px (40px in 4096 extent) -> true with 3px margin
      expect(isPointInFlatGeometry({ x: toPx(1960), y: toPx(2500) }, multiCoords, multiEnds, 4096, 0)).toBe(false);
      expect(isPointInFlatGeometry({ x: toPx(1960), y: toPx(2500) }, multiCoords, multiEnds, 4096, 3)).toBe(true);
    });
  });

  describe('Reserved Override IDs', () => {
    it('provides an ID mapping covering all override airspaces', () => {
      const overrideNames = Object.values(AIRSPACE_OVERRIDE_ID_TO_NAME);
      expect(Object.keys(AIRSPACE_OVERRIDE_ID_TO_NAME)).toHaveLength(overrideNames.length);
      for (const [idStr, name] of Object.entries(AIRSPACE_OVERRIDE_ID_TO_NAME)) {
        const id = Number(idStr);
        expect(id).toBeGreaterThan(0);
        expect(id).toBeLessThanOrEqual(RESERVED_AIRSPACE_ID_MAX);
        expect(overrideNames).toContain(name);
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

  describe('Airspace PMTiles URLs', () => {
    it('provides correct base URLs', () => {
      expect(CLOUD_AIRSPACE_BASE_URL).toBe('https://airspaces.flyxc.app');
      expect(LOCAL_AIRSPACE_BASE_URL).toBe('http://localhost:8084');
    });

    it('generates correct PMTiles URLs', () => {
      expect(AIRSPACE_3D_TILE_ZOOM).toBe(6);
      expect(getAirspacePmtilesUrl('cloud')).toBe('https://airspaces.flyxc.app/airspaces.pmtiles');
      expect(getAirspacePmtilesUrl('local')).toBe('http://localhost:8084/airspaces.pmtiles');
      expect(getAirspace3dPmtilesUrl('cloud')).toBe('https://airspaces.flyxc.app/airspaces-3d.pmtiles');
      expect(getAirspace3dPmtilesUrl('local')).toBe('http://localhost:8084/airspaces-3d.pmtiles');
    });
  });
});
