import { NO_ALTITUDE } from '@flyxc/common';

import feed from './fixtures/inreach-feed.kml?raw';
import { parse } from './inreach';

describe('Parse kml feed', () => {
  it('Should parse a valid feed', () => {
    const points = parse(feed);
    expect(points).toEqual(
      [
        {
          name: 'inreach',
          alt: 8,
          emergency: false,
          lat: 37.385005,
          lon: -122.027765,
          message: 'Starting my trip. Follow me on where.vicb.fr',
          speed: 0,
          timeSec: 1571510460,
          valid: true,
        },
        {
          name: 'inreach',
          alt: 8,
          emergency: true,
          lat: 37.385015,
          lon: -122.027785,
          message: undefined,
          speed: 0,
          timeSec: 1571510490,
          valid: true,
        },
        {
          name: 'inreach',
          alt: 19,
          emergency: false,
          lat: 37.384993,
          lon: -122.027721,
          message: undefined,
          speed: 6,
          timeSec: 1571511090,
          valid: false,
        },
        {
          name: 'inreach',
          alt: 10,
          emergency: false,
          lat: 37.385058,
          lon: -122.027765,
          message: undefined,
          speed: 0,
          timeSec: 1571511405,
          valid: true,
        },
      ].map(({ name: _, ...point }) => point),
    );
  });

  it('should parse the coordinates', () => {
    expect(parse(feed)[0]).toMatchObject({
      alt: 8,
      lat: 37.385005,
      lon: -122.027765,
    });
  });

  it('should parse the timestamp', () => {
    expect(parse(feed)[0]).toMatchObject({
      timeSec: 1571510460,
    });
  });

  it('should parse messages', () => {
    expect(parse(feed)[0]).toMatchObject({
      message: 'Starting my trip. Follow me on where.vicb.fr',
    });
  });

  it('should report emergency', () => {
    expect(parse(feed)[0].emergency).toBe(false);
    expect(parse(feed)[1].emergency).toBe(true);
  });

  it('should report invalid fix', () => {
    expect(parse(feed)[0].valid).toBe(true);
    expect(parse(feed)[2].valid).toBe(false);
  });

  it('Should parse an empty feed', () => {
    expect(parse('')).toEqual([]);
  });

  it('should throw on invalid feed', () => {
    expect(() => parse('<')).toThrow(/Invalid InReach feed/);
  });

  it('should use NO_ALTITUDE when coordinates lack altitude', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <TimeStamp><when>2019-10-20T00:01:00Z</when></TimeStamp>
      <Point><coordinates>-122.027765,37.385005</coordinates></Point>
      <ExtendedData>
        <Data name="Velocity"><value>0 km/h</value></Data>
        <Data name="In Emergency"><value>False</value></Data>
        <Data name="Valid GPS Fix"><value>True</value></Data>
      </ExtendedData>
    </Placemark>
  </Document>
</kml>`;
    const points = parse(kml);
    expect(points).toHaveLength(1);
    expect(points[0].alt).toBe(NO_ALTITUDE);
  });
});
