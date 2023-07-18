import { protos } from '@flyxc/common';
import { parse, parseRoute } from './gpx';

describe('Parse GPX files', () => {
  describe('Invalid', () => {
    test('turnpoints', () => {
      expect(
        parseRoute(`<?xml version="1.0" encoding="UTF-8"?>
        <gpx>
          <data>
            <rte>
              <rtept lat="1.1" lon="-1.1">
                <name>FXC001</name>
              </rtept>
            </rte>
          </data>
          <schemaLocation>http://www.topografix.com/GPX/1/1,http://www.topografix.com/GPX/1/1/gpx.xsd</schemaLocation>
        </gpx>`),
      ).toBe(null);
    });
  });

  describe('Valid', () => {
    test('route', () => {
      expect(
        parseRoute(`<?xml version="1.0" encoding="UTF-8"?>
        <gpx>
          <data>
            <rte>
              <rtept lat="1.1" lon="-1.1">
                <name>FXC001</name>
              </rtept>
              <rtept lat="2.2" lon="-2.2">
                <name>FXC002</name>
              </rtept>
            </rte>
          </data>
          <schemaLocation>http://www.topografix.com/GPX/1/1,http://www.topografix.com/GPX/1/1/gpx.xsd</schemaLocation>
        </gpx>`),
      ).toEqual(
        protos.Route.create({
          lat: [1.1, 2.2],
          lon: [-1.1, -2.2],
          alt: [0, 0],
        }),
      );
    });

    test('track with time', () => {
      expect(
        parse(`<?xml version="1.0" encoding="UTF-8"?>
        <gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
         <metadata>
          <time>2017-06-24T05:23:39Z</time>
         </metadata>
         <trk>
          <trkseg>
           <trkpt lat="41.3537280" lon="-122.2337480">
            <ele>2102.7</ele>
            <time>2017-06-24T05:23:39Z</time>
           </trkpt>
           <trkpt lat="41.3549080" lon="-122.2328430">
            <ele>2120.7</ele>
            <time>2017-06-24T05:25:13Z</time>
           </trkpt>
           <trkpt lat="41.3550930" lon="-122.2327350">
            <ele>2122.6</ele>
            <time>2017-06-24T05:27:09Z</time>
           </trkpt>
          </trkseg>
         </trk>
        </gpx>`),
      ).toMatchInlineSnapshot(`
        [
          {
            "alt": [
              2102.7,
              2120.7,
              2122.6,
            ],
            "lat": [
              41.353728,
              41.354908,
              41.355093,
            ],
            "lon": [
              -122.233748,
              -122.232843,
              -122.232735,
            ],
            "pilot": "unknown",
            "timeSec": [
              1498281819,
              1498281913,
              1498282029,
            ],
          },
        ]
      `);
    });

    test('track without time', () => {
      expect(
        parse(`<?xml version="1.0" encoding="UTF-8"?>
        <gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
         <metadata>
          <time>2017-06-24T05:23:39Z</time>
         </metadata>
         <trk>
          <trkseg>
           <trkpt lat="41.3537280" lon="-122.2337480">
            <ele>2102.7</ele>
           </trkpt>
           <trkpt lat="41.3549080" lon="-122.2328430">
            <ele>2120.7</ele>
           </trkpt>
           <trkpt lat="41.3550930" lon="-122.2327350">
            <ele>2122.6</ele>
           </trkpt>
          </trkseg>
         </trk>
        </gpx>`),
      ).toMatchInlineSnapshot(`
        [
          {
            "alt": [
              2102.7,
              2120.7,
              2122.6,
            ],
            "lat": [
              41.353728,
              41.354908,
              41.355093,
            ],
            "lon": [
              -122.233748,
              -122.232843,
              -122.232735,
            ],
            "pilot": "unknown",
            "timeSec": [
              946684800,
              946684810,
              946684820,
            ],
          },
        ]
      `);
    });
  });
});
