import { parse } from './kml';

describe('Parse KML files', () => {
  test('parse KML with LineString and coordinates', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>Test KML Track</name>
        <Placemark>
          <name>Track 1</name>
          <LineString>
            <coordinates>
              -122.233748,41.353728,2102.7
              -122.232843,41.354908,2120.7
              -122.232735,41.355093,2122.6
            </coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;

    const tracks = parse(kml);
    expect(tracks).toMatchInlineSnapshot(`
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

  test('parse empty / invalid KML returns empty tracks', () => {
    expect(parse('')).toEqual([]);
    expect(parse('<invalid></invalid>')).toEqual([]);
  });
});
