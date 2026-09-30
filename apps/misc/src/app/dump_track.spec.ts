import { diffEncodeTrack, protos } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { createDefaultFileName, flightToCsv, formatUtcTime } from './dump_track';

describe('dump_track', () => {
  describe('formatUtcTime', () => {
    it('formats epoch 0 as 00:00:00', () => {
      expect(formatUtcTime(0)).toBe('00:00:00');
    });

    it('formats UTC time correctly', () => {
      // 2023-11-15T14:05:09Z
      const date = new Date(Date.UTC(2023, 10, 15, 14, 5, 9));
      const sec = Math.floor(date.getTime() / 1000);
      expect(formatUtcTime(sec)).toBe('14:05:09');
    });

    it('pads single-digit hours, minutes, and seconds', () => {
      // 1:02:03 UTC on 1970-01-01
      const sec = 1 * 3600 + 2 * 60 + 3;
      expect(formatUtcTime(sec)).toBe('01:02:03');
    });
  });

  describe('createDefaultFileName', () => {
    it('generates filename from pilot name and timestamp in YYYYMMDD format', () => {
      // 2024-05-18T10:00:00Z
      const date = new Date(Date.UTC(2024, 4, 18, 10, 0, 0));
      const sec = Math.floor(date.getTime() / 1000);
      expect(createDefaultFileName('Victor Berchet', sec)).toBe('Victor Berchet-20240518.csv');
    });

    it('defaults to "pilot" when pilot name is missing or empty', () => {
      const date = new Date(Date.UTC(2024, 0, 5, 12, 0, 0));
      const sec = Math.floor(date.getTime() / 1000);
      expect(createDefaultFileName(undefined, sec)).toBe('pilot-20240105.csv');
      expect(createDefaultFileName('', sec)).toBe('pilot-20240105.csv');
    });

    it('sanitizes illegal path characters in pilot name', () => {
      const date = new Date(Date.UTC(2024, 8, 30, 0, 0, 0));
      const sec = Math.floor(date.getTime() / 1000);
      expect(createDefaultFileName('John/Doe:Test', sec)).toBe('John_Doe_Test-20240930.csv');
    });

    it('uses fallback date if timestamp is missing', () => {
      const fallback = new Date(Date.UTC(2023, 5, 20));
      expect(createDefaultFileName('Pilot', undefined, fallback)).toBe('Pilot-20230620.csv');
    });
  });

  describe('flightToCsv', () => {
    it('outputs header line for empty track group', () => {
      const emptyTrackGroup = protos.TrackGroup.toBinary({ tracks: [] });
      const { csv, numPositions } = flightToCsv(emptyTrackGroup);
      expect(csv).toBe('latitude,longitude,altitude,time,timestamp');
      expect(numPositions).toBe(0);
    });

    it('decodes single track with positions into csv and generates default filename', () => {
      const timestamp = Math.floor(Date.UTC(2023, 6, 12, 11, 0, 0) / 1000);
      const rawTrack: protos.Track = {
        pilot: 'Alice',
        lat: [45.12345, 45.12355],
        lon: [6.12345, 6.12355],
        alt: [1200, 1250],
        timeSec: [timestamp, timestamp + 60],
      };

      const encodedTrack = diffEncodeTrack(rawTrack);
      const trackGroupBin = protos.TrackGroup.toBinary({ tracks: [encodedTrack] });

      const { csv, defaultFileName, numPositions } = flightToCsv(trackGroupBin);
      const lines = csv.split('\n');

      expect(defaultFileName).toBe('Alice-20230712.csv');
      expect(numPositions).toBe(2);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('latitude,longitude,altitude,time,timestamp');

      const expectedTime1 = formatUtcTime(timestamp);
      const expectedTime2 = formatUtcTime(timestamp + 60);

      expect(lines[1]).toBe(`45.12345,6.12345,1200,${expectedTime1},${timestamp}`);
      expect(lines[2]).toBe(`45.12355,6.12355,1250,${expectedTime2},${timestamp + 60}`);
    });

    it('decodes multiple tracks in a track group', () => {
      const timestamp = Math.floor(Date.UTC(2023, 0, 1, 10, 0, 0) / 1000);
      const track1: protos.Track = diffEncodeTrack({
        pilot: 'Bob',
        lat: [45.0],
        lon: [6.0],
        alt: [1000],
        timeSec: [timestamp],
      });
      const track2: protos.Track = diffEncodeTrack({
        pilot: 'Bob',
        lat: [46.0],
        lon: [7.0],
        alt: [2000],
        timeSec: [timestamp + 100],
      });

      const trackGroupBin = protos.TrackGroup.toBinary({ tracks: [track1, track2] });
      const { csv, defaultFileName, numPositions } = flightToCsv(trackGroupBin);
      const lines = csv.split('\n');

      expect(defaultFileName).toBe('Bob-20230101.csv');
      expect(numPositions).toBe(2);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('latitude,longitude,altitude,time,timestamp');
      expect(lines[1]).toBe(`45,6,1000,${formatUtcTime(timestamp)},${timestamp}`);
      expect(lines[2]).toBe(`46,7,2000,${formatUtcTime(timestamp + 100)},${timestamp + 100}`);
    });
  });
});
