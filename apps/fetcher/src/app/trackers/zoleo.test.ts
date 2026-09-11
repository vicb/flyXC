import { protos } from '@flyxc/common';
import type { ZoleoMessage } from '@flyxc/common-node';

import { parse } from './zoleo';

describe('parse', () => {
  it('should parse messages', () => {
    const zoleoMsgs: ZoleoMessage[] = [
      { type: 'imei', id: '12345678-1234-1234-1234-123456789012', imei: '012345678912345' },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38525,
        lon: -122.02778,
        speedKph: 12,
        altitudeM: 321,
        batteryPercent: 25,
        timeMs: 1687735167893,
        imei: '012345678912345',
        message: 'Check-In',
      },
      {
        type: 'location',
        id: '12345678-1234-1234-1234-123456789012',
        lat: 37.38525,
        lon: -122.02778,
        speedKph: 13,
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
        speedKph: 14,
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
        speedKph: 15,
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
        speedKph: 16,
        altitudeM: 325,
        batteryPercent: 5,
        timeMs: 1687735999608,
        imei: '012345678912345',
      },
    ];

    expect(parse(zoleoMsgs)).toMatchInlineSnapshot(`
      Map {
        "12345678-1234-1234-1234-123456789012" => [
          {
            "alt": 321,
            "emergency": undefined,
            "lat": 37.38525,
            "lon": -122.02778,
            "message": "Check-In",
            "name": "zoleo",
            "speed": 12,
            "timeMs": 1687735167893,
          },
          {
            "alt": 322,
            "emergency": undefined,
            "lat": 37.38525,
            "lon": -122.02778,
            "message": undefined,
            "name": "zoleo",
            "speed": 13,
            "timeMs": 1687735170324,
          },
          {
            "alt": 323,
            "emergency": undefined,
            "lat": 37.38532,
            "lon": -122.02776,
            "lowBattery": true,
            "message": undefined,
            "name": "zoleo",
            "speed": 14,
            "timeMs": 1687735352016,
          },
          {
            "alt": 324,
            "emergency": undefined,
            "lat": 37.38718,
            "lon": -122.02649,
            "lowBattery": true,
            "message": undefined,
            "name": "zoleo",
            "speed": 15,
            "timeMs": 1687735712035,
          },
          {
            "alt": 325,
            "emergency": undefined,
            "lat": 37.38475,
            "lon": -122.02825,
            "lowBattery": true,
            "message": undefined,
            "name": "zoleo",
            "speed": 16,
            "timeMs": 1687735999608,
          },
        ],
      }
    `);
  });

  it('should attach a location-less message to the closest position', () => {
    const id = '12345678-1234-1234-1234-123456789012';
    expect(
      parse([
        {
          type: 'location',
          id,
          lat: 1,
          lon: 2,
          speedKph: 3,
          altitudeM: 4,
          batteryPercent: 50,
          timeMs: 1000,
          imei: '012345678912345',
        },
        {
          type: 'message',
          id,
          timeMs: 1100,
          imei: '012345678912345',
          batteryPercent: 100,
          message: 'Email message',
        },
        {
          type: 'location',
          id,
          lat: 5,
          lon: 6,
          speedKph: 7,
          altitudeM: 8,
          batteryPercent: 50,
          timeMs: 1200,
          imei: '012345678912345',
        },
      ]),
    ).toEqual(
      new Map([
        [
          id,
          [
            {
              lat: 1,
              lon: 2,
              alt: 4,
              speed: 3,
              timeMs: 1000,
              name: 'zoleo',
              message: 'Email message',
            },
            {
              lat: 5,
              lon: 6,
              alt: 8,
              speed: 7,
              timeMs: 1200,
              name: 'zoleo',
            },
          ],
        ],
      ]),
    );
  });

  it('should attach a location-less message to a recent known position', () => {
    vi.useFakeTimers({ now: 234500 });
    const id = '12345678-1234-1234-1234-123456789012';

    expect(
      parse(
        [
          {
            type: 'message',
            id,
            timeMs: 234440,
            imei: '012345678912345',
            batteryPercent: 100,
            message: 'Email message',
          },
        ],
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
      ),
    ).toEqual(
      new Map([
        [
          id,
          [
            {
              lat: 21,
              lon: 31,
              alt: 11,
              timeMs: 234500,
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
