import { protos } from '@flyxc/common';
import { parseRoute } from './gpx';

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
  });
});
