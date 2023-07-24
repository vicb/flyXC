import { ZoleoMessage } from '@flyxc/common-node';
import { parse } from './zoleo';

describe('parse', () => {
  it('should parse messages', () => {
    const zoleoMsgs: ZoleoMessage[] = [
      { type: 'imei', id: 'fake-id', imei: '012345678912345' },
      {
        type: 'msg',
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
        type: 'msg',
        lat: 37.38525,
        lon: -122.02778,
        speedKph: 13,
        altitudeM: 322,
        batteryPercent: 20,
        timeMs: 1687735170324,
        imei: '012345678912345',
      },
      {
        type: 'msg',
        lat: 37.38532,
        lon: -122.02776,
        speedKph: 14,
        altitudeM: 323,
        batteryPercent: 15,
        timeMs: 1687735352016,
        imei: '012345678912345',
      },
      {
        type: 'msg',
        lat: 37.38718,
        lon: -122.02649,
        speedKph: 15,
        altitudeM: 324,
        batteryPercent: 10,
        timeMs: 1687735712035,
        imei: '012345678912345',
      },
      {
        type: 'msg',
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
        "012345678912345" => [
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
});
