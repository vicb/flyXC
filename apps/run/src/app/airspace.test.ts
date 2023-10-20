import { diffDecodeTrack, protos } from '@flyxc/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchAirspaces, getIndicesByUrlAndPx } from './airspace';

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
      expect(indexesByTileUrl.has('https://airsp.storage.googleapis.com/tiles/13/3284/4244.pbf'));
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
      expect(indexesByTileUrl.has('https://airsp.storage.googleapis.com/tiles/13/3284/4244.pbf'));
    });
  });

  describe('fetchAirspaces', () => {
    it('should find the airspaces', async () => {
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
          ],
          "bottom": [
            1067,
            0,
            1829,
            0,
          ],
          "category": [],
          "endSec": [
            1666952265,
            1666956657,
            1666956657,
            1666979209,
          ],
          "flags": [
            1,
            18,
            2,
            34,
          ],
          "hasErrors": false,
          "icaoClass": [
            2,
            5,
            5,
            6,
          ],
          "into": [
            false,
            true,
            false,
            false,
          ],
          "name": [
            "TMA-NATAL",
            "SBR223- WHISKY_DOIS",
            "SBR224- WISKY100",
            "G - SBR266-QUIXADA",
          ],
          "startSec": [
            1666949217,
            1666952369,
            1666952369,
            1666978953,
          ],
          "top": [
            4420,
            8839,
            4572,
            1006,
          ],
          "type": [
            0,
            0,
            0,
            0,
          ],
        }
      `);
    });
  });
});
