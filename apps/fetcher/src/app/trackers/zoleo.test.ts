import { protos } from '@flyxc/common';
import type { ZoleoMessage } from '@flyxc/common-node';

import { handleLocationlessMessage, parse } from './zoleo';

describe('parse', () => {
  it('should parse messages', () => {
    vi.useFakeTimers({ now: 1687736000000 });
    const id = '12345678-1234-1234-1234-123456789012';
    const zoleoMsgs: ZoleoMessage[] = [
      { type: 'imei', id, imei: '012345678912345' },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38525,
        lon: -122.02778,
        altitudeM: 321,
        batteryPercent: 25,
        timeMs: 1687735167893,
        imei: '012345678912345',
        message: 'Check-In',
      },
      {
        type: 'message',
        id,
        lat: 37.3855,
        lon: -122.0275,
        altitudeM: 320,
        timeMs: 1687735169000,
        imei: '012345678912345',
        batteryPercent: 100,
        message: 'Email with location',
      },
      {
        type: 'message',
        id,
        timeMs: 1687736000000,
        imei: '012345678912345',
        batteryPercent: 100,
        message: 'Email without location',
      },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38525,
        lon: -122.02778,
        altitudeM: 322,
        batteryPercent: 20,
        timeMs: 1687735170324,
        imei: '012345678912345',
      },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38532,
        lon: -122.02776,
        altitudeM: 323,
        batteryPercent: 15,
        timeMs: 1687735352016,
        imei: '012345678912345',
      },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38718,
        lon: -122.02649,
        altitudeM: 324,
        batteryPercent: 10,
        timeMs: 1687735712035,
        imei: '012345678912345',
      },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38475,
        lon: -122.02825,
        altitudeM: 325,
        batteryPercent: 5,
        timeMs: 1687735999608,
        imei: '012345678912345',
      },
    ];

    const pointsById = parse(zoleoMsgs);
    handleLocationlessMessage(
      zoleoMsgs,
      pointsById,
      new Map([[id, 10]]),
      {
        '10': protos.Pilot.create({
          track: protos.LiveTrack.create({
            alt: [330],
            lat: [37.384],
            lon: [-122.028],
            timeSec: [1687735999],
          }),
        }),
      },
      15,
    );

    expect(pointsById).toMatchInlineSnapshot(`
      Map {
        "12345678-1234-1234-1234-123456789012" => [
          {
            "alt": 321,
            "lat": 37.38525,
            "lon": -122.02778,
            "message": "Check-In",
            "name": "zoleo",
            "timeMs": 1687735167893,
          },
          {
            "alt": 320,
            "lat": 37.3855,
            "lon": -122.0275,
            "message": "Email with location",
            "name": "zoleo",
            "timeMs": 1687735169000,
          },
          {
            "alt": 322,
            "lat": 37.38525,
            "lon": -122.02778,
            "name": "zoleo",
            "timeMs": 1687735170324,
          },
          {
            "alt": 323,
            "lat": 37.38532,
            "lon": -122.02776,
            "lowBattery": true,
            "name": "zoleo",
            "timeMs": 1687735352016,
          },
          {
            "alt": 324,
            "lat": 37.38718,
            "lon": -122.02649,
            "lowBattery": true,
            "name": "zoleo",
            "timeMs": 1687735712035,
          },
          {
            "alt": 325,
            "lat": 37.38475,
            "lon": -122.02825,
            "lowBattery": true,
            "name": "zoleo",
            "timeMs": 1687735999608,
          },
          {
            "alt": 330,
            "lat": 37.384,
            "lon": -122.028,
            "message": "Email without location",
            "name": "zoleo",
            "timeMs": 1687736000000,
          },
        ],
      }
    `);
  });

  it('should attach a location-less message to a recent known position', () => {
    vi.useFakeTimers({ now: 234500 });
    const id = '12345678-1234-1234-1234-123456789012';

    const message: ZoleoMessage = {
      type: 'message',
      id,
      timeMs: 234440,
      imei: '012345678912345',
      batteryPercent: 100,
      message: 'Email message',
    };
    const pointsById = parse([message]);
    handleLocationlessMessage(
      [message],
      pointsById,
      new Map([[id, 10]]),
      {
        '10': protos.Pilot.create({
          track: protos.LiveTrack.create({
            alt: [10, 11],
            lat: [20, 21],
            lon: [30, 31],
            timeSec: [123, 234],
          }),
        }),
      },
      1,
    );

    expect(pointsById).toEqual(
      new Map([
        [
          id,
          [
            {
              lat: 21,
              lon: 31,
              alt: 11,
              timeMs: 234440,
              name: 'zoleo',
              message: 'Email message',
            },
          ],
        ],
      ]),
    );
  });

  it('should add a message with a location as a new point', () => {
    const id = '12345678-1234-1234-1234-123456789012';

    expect(
      parse([
        {
          type: 'message',
          id,
          lat: 45.182,
          lon: 5.73797,
          timeMs: 234500,
          imei: '012345678912345',
          batteryPercent: 100,
          message: 'Email message',
        },
      ]),
    ).toEqual(
      new Map([
        [
          id,
          [
            {
              lat: 45.182,
              lon: 5.73797,
              alt: 0,
              timeMs: 234500,
              name: 'zoleo',
              message: 'Email message',
            },
          ],
        ],
      ]),
    );
  });
});
