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
      expect(indexesByTileUrl.size).toEqual(74);
      expect(pxInTiles).toHaveLength(4915);
      expect(indexesByTileUrl.has('https://airsp.storage.googleapis.com/tiles/13/3284/4244.pbf'));
    });

    it('Number of tiles for a huge track', () => {
      const track = readTrack('huge.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track);
      expect(indexesByTileUrl.size).toEqual(474);
      expect(pxInTiles).toHaveLength(6236);
    });

    it('Should support a upper bound of tiles', () => {
      const track = readTrack('570kms.pbf');
      const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track, 5);
      expect(indexesByTileUrl.size).toEqual(5);
      expect(pxInTiles).toHaveLength(523);
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
      expect(await fetchAirspaces(track, gndAltitude)).toMatchSnapshot();
    });
  });
});
