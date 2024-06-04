import { readFileSync } from 'node:fs';
import path from 'node:path';

import { diffDecodeTrack, protos } from '@flyxc/common';

import { fetchGroundAltitude, getUrlList } from './altitude';

function readTrack(filename: string): protos.Track {
  const pbf = readFileSync(path.join(__dirname, 'fixtures', filename));
  const { metaTrackGroups } = protos.MetaTrackGroupsAndRoute.fromBinary(new Uint8Array(pbf));

  expect(metaTrackGroups).toHaveLength(1);
  expect(metaTrackGroups[0].trackGroupBin).not.toBeNull();
  const trackGroup = protos.TrackGroup.fromBinary(metaTrackGroups[0].trackGroupBin);

  expect(trackGroup.tracks).toHaveLength(1);
  return diffDecodeTrack(trackGroup.tracks[0]);
}

describe('Altitude', () => {
  describe('Extract urls from tracks', () => {
    it('Number of urls for a big track', () => {
      const track = readTrack('570kms.pbf');
      expect(getUrlList(track)).toHaveLength(19);
    });

    it('Number of urls for a huge track', () => {
      const track = readTrack('huge.pbf');
      expect(getUrlList(track)).toHaveLength(127);
    });

    it('Number of urls for another huge track', () => {
      const track = readTrack('5157934597144576.pbf');
      expect(getUrlList(track)).toHaveLength(80);
    });

    it('Should support a upper bound of tiles', () => {
      const track = readTrack('570kms.pbf');
      expect(getUrlList(track, 5)).toHaveLength(5);
    });
  });

  it('should retrieve a track gnd altitude', async () => {
    const track = readTrack('570kms.pbf');
    expect(await fetchGroundAltitude(track)).toMatchSnapshot();
  });
});
