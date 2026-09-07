import { readFileSync } from 'node:fs';
import path from 'node:path';

import lodepng from '@cwasm/lodepng';
import { diffDecodeTrack, protos } from '@flyxc/common';

import { fetchGroundAltitude } from './altitude';

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
  it('should retrieve a track gnd altitude', async () => {
    const track = readTrack('570kms.pbf');
    expect(await fetchGroundAltitude(track)).toMatchSnapshot();
  });

  describe('PNG decoding and altitude parsing', () => {
    it('should decode a terrarium tile and parse altitude correctly for Mont Blanc', () => {
      // Tile 10/531/364 contains the Mont Blanc in France (45.8326° N, 6.8652° E).
      const pbf = readFileSync(path.join(__dirname, 'fixtures', 'x531y364z10.png'));
      const img = lodepng.decode(pbf);

      expect(img.width).toBe(256);
      expect(img.height).toBe(256);
      expect(img.data).toBeInstanceOf(Uint8ClampedArray);
      expect(img.data.length).toBe(256 * 256 * 4);

      // Verify the altitude at the pixel (135, 252) corresponding to the peak of Mont Blanc.
      const offset = 4 * (256 * 252 + 135);
      const red = img.data[offset];
      const green = img.data[offset + 1];
      const blue = img.data[offset + 2];

      const altitude = Math.round(red * 256 + green + blue / 256 - 32768);
      expect(altitude).toBe(4757);
    });
  });
});
