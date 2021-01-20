/* eslint-disable @typescript-eslint/no-var-requires */
const skyline = require('./fixtures/skylines.json');
const skylineTrack = require('./fixtures/skylines-track.json');

import { parse } from 'flyxc/run/src/trackers/skylines';

describe('Parse Skylines json', () => {
  test('it should parse a flight', () => {
    expect(parse(skyline.flights[0], 1603927806000)).toEqual(skylineTrack);
  });

  test('it should decode tracks crossing midnight UTC', () => {
    // October 14, 2020 12:32:43 PM GMT-07:00
    const firstTimestamp = 1602703963000;
    // October 14, 2020 4:30:06 PM GMT-07:00
    const lastTimestamp = 1602718206000;

    // October 14, 2020 4:50:00 PM GMT-07:00 DST
    // October 14, 2020 11:50:00 PM GMT
    const beforeMidnightSecs = 1602719400;
    let points = parse(skyline.flights[0], beforeMidnightSecs * 1000);
    expect(points).toHaveLength(374);
    expect(points[0].timestamp).toBe(firstTimestamp);
    expect(points[points.length - 1].timestamp).toBe(lastTimestamp);

    // October 14, 2020 5:50:00 PM GMT-07:00
    // October 15, 2020 12:50:00 AM (GMT)
    const afterMidnightSecs = 1602723000;
    points = parse(skyline.flights[0], afterMidnightSecs * 1000);
    expect(points).toHaveLength(374);
    expect(points[0].timestamp).toBe(firstTimestamp);
    expect(points[points.length - 1].timestamp).toBe(lastTimestamp);
  });
});
