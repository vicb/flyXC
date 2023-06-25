import { ZoleoMessage } from '@flyxc/common-node';
import { parse } from './zoleo';

describe('parse', () => {
  it('should parse messaged', () => {
    const zoleoMsgs: ZoleoMessage[] = [
      { type: 'imei', id: 'fake-id', imei: '012345678912345' },
      {
        type: 'msg',
        lat: 37.38525,
        lon: -122.02778,
        timeMs: 1687735167893,
        imei: '012345678912345',
        message: 'Check-In',
      },
      { type: 'msg', lat: 37.38525, lon: -122.02778, timeMs: 1687735170324, imei: '012345678912345' },
      { type: 'msg', lat: 37.38532, lon: -122.02776, timeMs: 1687735352016, imei: '012345678912345' },
      { type: 'msg', lat: 37.38718, lon: -122.02649, timeMs: 1687735712035, imei: '012345678912345' },
      { type: 'msg', lat: 37.38475, lon: -122.02825, timeMs: 1687735999608, imei: '012345678912345' },
    ];

    expect(parse(zoleoMsgs)).toMatchInlineSnapshot(`
      Map {
        "012345678912345" => [
          {
            "alt": 0,
            "emergency": undefined,
            "lat": 37.38525,
            "lon": -122.02778,
            "message": "Check-In",
            "name": "zoleo",
            "timeMs": 1687735167893,
          },
          {
            "alt": 0,
            "emergency": undefined,
            "lat": 37.38525,
            "lon": -122.02778,
            "message": undefined,
            "name": "zoleo",
            "timeMs": 1687735170324,
          },
          {
            "alt": 0,
            "emergency": undefined,
            "lat": 37.38532,
            "lon": -122.02776,
            "message": undefined,
            "name": "zoleo",
            "timeMs": 1687735352016,
          },
          {
            "alt": 0,
            "emergency": undefined,
            "lat": 37.38718,
            "lon": -122.02649,
            "message": undefined,
            "name": "zoleo",
            "timeMs": 1687735712035,
          },
          {
            "alt": 0,
            "emergency": undefined,
            "lat": 37.38475,
            "lon": -122.02825,
            "message": undefined,
            "name": "zoleo",
            "timeMs": 1687735999608,
          },
        ],
      }
    `);
  });
});
