import type { XContestFlight } from './xcontest';
import { parseLiveTrack, parseLiveUsers } from './xcontest';

/* eslint-disable @typescript-eslint/no-var-requires */
const xcontestUsers = require('./fixtures/xcontest-live-users.json');
const xcontestTrack = require('./fixtures/xcontest-live-track.json');

describe('Parse XContest json', () => {
  test('it should parse users', () => {
    const idToLastFlight = new Map<string, XContestFlight>();
    parseLiveUsers(xcontestUsers, idToLastFlight, 1649089830000);
    expect(idToLastFlight).toMatchInlineSnapshot(`
      Map {
        "user-id-1" => {
          "lastTimeMs": 1649089840000,
          "uuid": "flight-id-2",
        },
      }
    `);
  });

  test('it should discard stale positions', () => {
    const idToLastFlight = new Map<string, XContestFlight>();
    parseLiveUsers(xcontestUsers, idToLastFlight, 1649089850000);
    expect(idToLastFlight.size).toBe(0);
  });

  test('it should parse tracks', () => {
    const points = parseLiveTrack(xcontestTrack);
    expect(points).toMatchInlineSnapshot(`
      [
        {
          "alt": 210,
          "lat": 46.154038,
          "lon": 7.602978,
          "name": "xcontest",
          "timeMs": 1649081971000,
        },
        {
          "alt": 211,
          "lat": 46.154038,
          "lon": 7.602978,
          "name": "xcontest",
          "timeMs": 1649081972000,
        },
        {
          "alt": 212,
          "lat": 46.154038,
          "lon": 7.602978,
          "name": "xcontest",
          "timeMs": 1649081973000,
        },
      ]
    `);
  });
});
