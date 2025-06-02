import { encodeGPXRoute } from './waypoints';

describe('waypoints', () => {
  test('encodeGPXRoute', () => {
    expect(
      encodeGPXRoute(
        [
          { lat: 1.1, lon: 2.2, alt: 100 },
          { lat: 3.3, lon: 4.4, alt: 200 },
          { lat: 5.5, lon: 6.6, alt: 300 },
        ],

        'pre',
      ),
    ).toMatchInlineSnapshot(`
      {
        "file": "<?xml version="1.0" encoding="UTF-8"?>
      <gpx>
        <data>
          <rte>
            <name>flyXC route</name>
            <rtept lat="1.100000" lon="2.200000">
              <name>pre001</name>
            </rtept>
            <rtept lat="3.300000" lon="4.400000">
              <name>pre002</name>
            </rtept>
            <rtept lat="5.500000" lon="6.600000">
              <name>pre003</name>
            </rtept>
          </rte>
        </data>
        <schemaLocation>http://www.topografix.com/GPX/1/1,https://www.topografix.com/GPX/1/1/gpx.xsd</schemaLocation>
      </gpx>",
        "filename": "route.gpx",
        "mime": "application/gpx+xml",
      }
    `);
  });
});
