import { readFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

import * as common from '@flyxc/common';
import { diffDecodeTrack, PMTiles, type PmtilesSource, protos } from '@flyxc/common';

import { fetchAirspaces, getIndicesByUrlAndPx, populateTileCache } from './airspace';

function readTrack(filename: string): protos.Track {
  const pbf = readFileSync(path.join(__dirname, 'fixtures', filename));
  const { metaTrackGroups } = protos.MetaTrackGroupsAndRoute.fromBinary(new Uint8Array(pbf));

  expect(metaTrackGroups).toHaveLength(1);
  expect(metaTrackGroups[0].trackGroupBin).not.toBeNull();
  const trackGroup = protos.TrackGroup.fromBinary(metaTrackGroups[0].trackGroupBin);

  expect(trackGroup.tracks).toHaveLength(1);
  return diffDecodeTrack(trackGroup.tracks[0]);
}

describe('Airspaces', () => {
  describe('Extract info from tracks', () => {
    it('Number of tiles for a big track', () => {
      const track = readTrack('570kms.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track);
      expect(indexesByTileUrl.size).toEqual(19);
      expect(pxInTiles).toHaveLength(4915);
      expect(indexesByTileUrl.has('410/530')).toBe(true);
    });

    it('Number of tiles for a huge track', () => {
      const track = readTrack('huge.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track);
      expect(indexesByTileUrl.size).toEqual(127);
      expect(pxInTiles).toHaveLength(6236);
    });

    it('Number of tiles for another huge track', () => {
      const track = readTrack('5157934597144576.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track);
      expect(indexesByTileUrl.size).toEqual(80);
      expect(pxInTiles).toHaveLength(6676);
    });

    it('Should support a upper bound of tiles', () => {
      const track = readTrack('570kms.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track, 5);
      expect(indexesByTileUrl.size).toEqual(5);
      expect(pxInTiles).toHaveLength(1310);
      expect(indexesByTileUrl.has('410/530')).toBe(true);
    });
  });

  describe('fetchAirspaces', () => {
    it('should find the airspaces', async () => {
      const localPmtiles = path.join(__dirname, '../../../../libs/common/src/lib/fixtures/airspaces-test.pmtiles');
      const handle = await open(localPmtiles, 'r');
      const source: PmtilesSource = {
        getKey: () => localPmtiles,
        async getBytes(offset: number, length: number) {
          const buf = Buffer.allocUnsafe(length);
          const { bytesRead } = await handle.read(buf, 0, length, offset);
          return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead) };
        },
      };
      const pmtiles = new PMTiles(source);
      vi.spyOn(common, 'fetchPmtilesTile').mockImplementation(async (_url, z, x, y) => {
        const res = await pmtiles.getZxy(z, x, y);
        return res?.data ?? null;
      });

      try {
        const track = readTrack('570kms.pbf');
        const gndAltitude = protos.GroundAltitude.create({
          altitudes: new Array(track.lat.length).fill(0),
          hasErrors: false,
        });
        expect(await fetchAirspaces(track, gndAltitude)).toMatchInlineSnapshot(`
        {
          "activity": [
            0,
            0,
            0,
            0,
            0,
          ],
          "bottom": [
            1067,
            0,
            1829,
            1067,
            0,
          ],
          "category": [],
          "endSec": [
            1666956025,
            1666956657,
            1666956657,
            1666956041,
            1666979209,
          ],
          "flags": [
            1,
            18,
            2,
            1,
            34,
          ],
          "hasErrors": false,
          "icaoClass": [
            2,
            5,
            5,
            2,
            6,
          ],
          "into": [
            true,
            true,
            false,
            true,
            false,
          ],
          "name": [
            "TMA-NATAL",
            "SBR223- WHISKY_DOIS",
            "SBR224- WISKY100",
            "TMA-NATAL",
            "G - SBR266-QUIXADA",
          ],
          "startSec": [
            1666949217,
            1666952369,
            1666952369,
            1666956041,
            1666978953,
          ],
          "top": [
            5944,
            8839,
            4572,
            5944,
            1006,
          ],
          "type": [
            0,
            0,
            0,
            0,
            0,
          ],
        }
      `);
      } finally {
        vi.restoreAllMocks();
        await handle?.close();
      }
    });
  });

  describe('populateTileCache', () => {
    it('propagates errors when a task callback rejects', async () => {
      vi.spyOn(common, 'fetchPmtilesTile').mockResolvedValueOnce(null);
      const mockCache = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(() => {
          throw new Error('Cache error');
        }),
      } as any;

      try {
        await expect(populateTileCache(mockCache, ['1/2'])).rejects.toThrow('Cache error');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
