import { protos } from '@flyxc/common';

import { parse } from './xctsk';

describe('Parse XCTSk files', () => {
  describe('Invalid', () => {
    test('type', () => {
      expect(
        parse(`{
      "taskType": "CLaSSIC",
      "version": 1,
      "turnpoints": [
        {
          "radius": 400,
          "waypoint": {
            "name": "FXC001",
            "lat": 1.1,
            "lon": -1.1,
            "altSmoothed": 3
          }
        },
        {
          "radius": 400,
          "waypoint": {
            "name": "FXC002",
            "lat": 2.2,
            "lon": -2.2,
            "altSmoothed": 0
          }
        }
      ]
    }`),
      ).toBe(null);
    });

    test('version', () => {
      expect(
        parse(`{
    "taskType": "CLASSIC",
    "version": 2,
    "turnpoints": [
      {
        "radius": 400,
        "waypoint": {
          "name": "FXC001",
          "lat": "1.1",
          "lon": -1.1,
          "altSmoothed": 3
        }
      },
      {
        "radius": 400,
        "waypoint": {
          "name": "FXC002",
          "lat": "2.2",
          "lon": -2.2,
          "altSmoothed": 0
        }
      }
    ]
  }`),
      ).toBe(null);
    });

    test('turnpoints', () => {
      expect(
        parse(`{
      "taskType": "CLASSIC",
      "version": 1,
    }`),
      ).toBe(null);
    });
  });

  describe('Valid', () => {
    test('route', () => {
      expect(
        parse(`{
        "taskType": "CLASSIC",
        "version": 1,
        "turnpoints": [
          {
            "radius": 400,
            "waypoint": {
              "name": "FXC001",
              "lat": 1.1,
              "lon": -1.1,
              "altSmoothed": 3
            }
          },
          {
            "radius": 400,
            "waypoint": {
              "name": "FXC002",
              "lat": 2.2,
              "lon": -2.2,
              "altSmoothed": 0
            }
          }
        ]
      }`),
      ).toEqual(
        protos.Route.create({
          lat: [1.1, 2.2],
          lon: [-1.1, -2.2],
          alt: [3, 0],
        }),
      );
    });
  });
});
