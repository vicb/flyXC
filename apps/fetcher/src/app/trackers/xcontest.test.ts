/* eslint-disable @typescript-eslint/no-var-requires */
const xcontest = require('./fixtures/xcontest.json');

import { LivePoint } from './live-track';
import { parse } from './xcontest';

describe('Parse XContest json', () => {
  test('it should parse a flight', () => {
    const idToLivePoint = new Map<string, LivePoint>();
    parse(xcontest, idToLivePoint, 1649089830000);
    expect(idToLivePoint).toMatchInlineSnapshot(`
      Map {
        "kUgsHrVb3TSwVp23o9P1LsEaIWPZ" => {
          "alt": 210,
          "lat": 46.154038,
          "lon": 7.602978,
          "name": "xcontest",
          "timeMs": 1649089840000,
        },
      }
    `);
  });

  test('it should discard stale positions', () => {
    const idToLivePoint = new Map<string, LivePoint>();
    parse(xcontest, idToLivePoint, 1649089850000);
    expect(idToLivePoint.size).toBe(0);
  });
});
