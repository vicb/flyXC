import spot2Feed from './fixtures/spot2.txt?raw';
import spot3Feed from './fixtures/spot3.txt?raw';
import type { LivePoint } from './live-track';
import { parse } from './spot';

describe('Parse JSON feed', () => {
  let spot2: LivePoint[];
  let spot3: LivePoint[];

  beforeAll(() => {
    spot2 = parse(spot2Feed);
    spot3 = parse(spot3Feed);
  });
  it('should parse a spot2 Feeds', () => {
    expect(spot2).toEqual([
      {
        alt: 0,
        name: 'spot',
        emergency: false,
        lat: 44.06871,
        lon: 7.20849,
        lowBattery: false,
        message: undefined,
        timeMs: 1571231455000,
      },
      {
        alt: 0,
        name: 'spot',
        emergency: false,
        lat: 44.06923,
        lon: 7.20879,
        lowBattery: false,
        message: 'msg ok',
        timeMs: 1571230698000,
      },
      {
        alt: 0,
        name: 'spot',
        emergency: true,
        lat: 44.07498,
        lon: 7.20351,
        lowBattery: false,
        message: 'msg help',
        timeMs: 1571230128000,
      },
      {
        alt: 0,
        name: 'spot',
        emergency: false,
        lat: 44.04253,
        lon: 7.20452,
        lowBattery: true,
        message: undefined,
        timeMs: 1571229492000,
      },
      {
        alt: 0,
        name: 'spot',
        emergency: false,
        lat: 44.01246,
        lon: 7.22531,
        lowBattery: false,
        message: undefined,
        timeMs: 1571228890000,
      },
    ]);
  });

  it('should parse a spot3 feed', () => {
    expect(spot3).toEqual([
      {
        alt: 123,
        name: 'spot',
        emergency: false,
        lat: 44.06871,
        lon: 7.20849,
        lowBattery: false,
        message: undefined,
        timeMs: 1571231455000,
      },
      {
        alt: 456,
        name: 'spot',
        emergency: false,
        lat: 44.06923,
        lon: 7.20879,
        lowBattery: false,
        message: 'msg ok',
        timeMs: 1571230698000,
      },
      {
        alt: 789,
        name: 'spot',
        emergency: true,
        lat: 44.07498,
        lon: 7.20351,
        lowBattery: false,
        message: 'msg help',
        timeMs: 1571230128000,
      },
      {
        alt: 123,
        name: 'spot',
        emergency: false,
        lat: 44.04253,
        lon: 7.20452,
        lowBattery: true,
        message: undefined,
        timeMs: 1571229492000,
      },
      {
        alt: 456,
        name: 'spot',
        emergency: false,
        lat: 44.01246,
        lon: 7.22531,
        lowBattery: false,
        message: undefined,
        timeMs: 1571228890000,
      },
    ]);
  });

  it('should parse lowBattery', () => {
    expect(spot2[0].lowBattery).toBe(false);
    expect(spot2[3].lowBattery).toBe(true);
    expect(spot3[0].lowBattery).toBe(false);
    expect(spot3[3].lowBattery).toBe(true);
  });

  it('should parse emergency', () => {
    expect(spot2[0].message).toBeUndefined();
    expect(spot2[1].message).toEqual('msg ok');
    expect(spot2[2].message).toEqual('msg help');
    expect(spot3[0].message).toBeUndefined();
    expect(spot3[1].message).toEqual('msg ok');
    expect(spot3[2].message).toEqual('msg help');
  });

  it('should parse messages', () => {
    expect(spot2[0].emergency).toBe(false);
    expect(spot2[2].emergency).toBe(true);
    expect(spot3[0].emergency).toBe(false);
    expect(spot3[2].emergency).toBe(true);
  });

  it('should throw on invalid format', () => {
    expect(() => parse('random')).toThrow('Invalid SPOT json - feed: random');
  });

  it('should throw on invalid feed error', () => {
    const error = `{
        "response":{
          "errors":{
              "error":{
                "code":"E-0160",
                "text":"Feed Not Found",
                "description":"Feed with Id: invalid_feed_id not found."
              }
          }
        }
    }`;

    expect(() => parse(error)).toThrow(/Feed with Id: invalid_feed_id not found/);
  });

  it('should return an empty list of points when the feed is empty', () => {
    const empty = `{
        "response":{
          "errors":{
              "error":{
                "code":"E-0195",
                "text":"No Messages to display",
                "description":"No displayable messages found found for feed: 07GDWvsMqGG0QTFaYIVLnsS2yA3J9d6n7"
              }
          }
        }
    }`;

    expect(parse(empty)).toEqual([]);
  });
});
