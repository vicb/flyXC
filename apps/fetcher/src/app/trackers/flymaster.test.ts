import flymaster from './fixtures/flymaster.json';
import flymasterTrack from './fixtures/flymaster-track.json';
import { parse } from './flymaster';

describe('Parse Flymaster json', () => {
  test('it should parse a flight', () => {
    expect(parse(flymaster[5518])).toEqual(flymasterTrack);
  });
});
