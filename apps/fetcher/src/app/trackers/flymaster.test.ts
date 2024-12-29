import { parse } from './flymaster';

const flymaster = require('./fixtures/flymaster.json');
const flymasterTrack = require('./fixtures/flymaster-track.json');

describe('Parse Flymaster json', () => {
  test('it should parse a flight', () => {
    expect(parse(flymaster[5518])).toEqual(flymasterTrack);
  });
});
