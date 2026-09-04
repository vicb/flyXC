import { LiveDataRetentionSec, protos, trackerIdByName } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { createLiveTrackGroups, maybePushTrack } from './track-groups';

describe('maybePushTrack', () => {
  const nowSec = 1700000000;

  it('should return empty track immediately and not push when input track is empty', () => {
    const dst = protos.LiveDifferentialTrackGroup.create();
    const emptyTrack = protos.LiveTrack.create();

    const res = maybePushTrack(dst, emptyTrack, LiveDataRetentionSec.FullH24, 1, 'pilot', nowSec);

    expect(res.timeSec).toEqual([]);
    expect(dst.tracks).toHaveLength(0);
  });

  it('should return empty track and not push when all points are older than historySec', () => {
    const dst = protos.LiveDifferentialTrackGroup.create();
    const oldTrack: protos.LiveTrack = {
      timeSec: [nowSec - 25 * 3600, nowSec - 24 * 3600 - 10],
      lat: [45, 45.1],
      lon: [6, 6.1],
      alt: [1000, 1100],
      flags: [0, 0],
      extra: {},
    };

    const res = maybePushTrack(dst, oldTrack, LiveDataRetentionSec.FullH24, 1, 'pilot', nowSec);

    expect(res.timeSec).toEqual([]);
    expect(dst.tracks).toHaveLength(0);
  });

  it('should prune points and push differential track when points fall within historySec', () => {
    const dst = protos.LiveDifferentialTrackGroup.create();
    const mixedTrack: protos.LiveTrack = {
      timeSec: [nowSec - 25 * 3600, nowSec - 100],
      lat: [45, 45.1],
      lon: [6, 6.1],
      alt: [1000, 1100],
      flags: [0, 0],
      extra: {},
    };

    const res = maybePushTrack(dst, mixedTrack, LiveDataRetentionSec.FullH24, 42, 'John', nowSec);

    expect(res.timeSec).toEqual([nowSec - 100]);
    expect(dst.tracks).toHaveLength(1);
    expect(dst.tracks[0].id).toBe(42);
    expect(dst.tracks[0].name).toBe('John');
  });

  it('should handle string IDs (UFOs) properly', () => {
    const dst = protos.LiveDifferentialTrackGroup.create();
    const track: protos.LiveTrack = {
      timeSec: [nowSec - 50],
      lat: [45],
      lon: [6],
      alt: [1000],
      flags: [0],
      extra: {},
    };

    maybePushTrack(dst, track, LiveDataRetentionSec.FullH24, 'aviant-drone1', undefined, nowSec);

    expect(dst.tracks).toHaveLength(1);
    expect(dst.tracks[0].idStr).toBe('aviant-drone1');
  });
});

describe('createLiveTrackGroups', () => {
  const nowSec = 1700000000;

  it('should properly cascade and short-circuit track generation based on point ages', () => {
    const createTrack = (offsetSec: number, extraDevice = trackerIdByName.inreach): protos.LiveTrack => ({
      timeSec: [nowSec - offsetSec],
      lat: [45],
      lon: [6],
      alt: [1000],
      flags: [extraDevice],
      extra: {},
    });

    const state = protos.FetcherState.create({
      pilots: {
        // Pilot 1: flew 30 hours ago (should ONLY be in H48)
        1: {
          name: 'Pilot 30h',
          share: false,
          track: createTrack(30 * 3600),
        },
        // Pilot 2: flew 15 hours ago (should be in H48 and H24, but NOT in H12, longInc, shortInc)
        2: {
          name: 'Pilot 15h',
          share: false,
          track: createTrack(15 * 3600),
        },
        // Pilot 3: flew 1 hour ago (should be in H48, H24, H12, but NOT in longInc, shortInc)
        3: {
          name: 'Pilot 1h',
          share: false,
          track: createTrack(3600),
        },
        // Pilot 4: flew 10 minutes ago (should be in H48, H24, H12, longInc, but NOT shortInc)
        4: {
          name: 'Pilot 10m',
          share: false,
          track: createTrack(10 * 60),
        },
        // Pilot 5: flew 1 minute ago (should be in ALL groups)
        5: {
          name: 'Pilot 1m',
          share: true,
          track: createTrack(60),
        },
        // Pilot 6: empty track (should be in NO groups)
        6: {
          name: 'Pilot Empty',
          share: false,
          track: protos.LiveTrack.create(),
        },
      },
      ufoFleets: {
        aviant: {
          ufos: {
            // UFO 1: active 2 minutes ago (in all)
            drone1: createTrack(120),
            // UFO 2: active 18 hours ago (in H48 and H24 only)
            drone2: createTrack(18 * 3600),
          },
        },
      },
    });

    const groups = createLiveTrackGroups(state, nowSec);

    // H48 should contain:
    // Pilots: 1, 2, 3, 4, 5 (all except 6)
    // UFOs: drone1, drone2
    const h48Ids = groups.fullTracksH48.tracks.map((t) => t.id ?? t.idStr);
    expect(h48Ids).toContain(1);
    expect(h48Ids).toContain(2);
    expect(h48Ids).toContain(3);
    expect(h48Ids).toContain(4);
    expect(h48Ids).toContain(5);
    expect(h48Ids).not.toContain(6);
    expect(h48Ids).toContain('aviant-drone1');
    expect(h48Ids).toContain('aviant-drone2');
    expect(groups.fullTracksH48.tracks).toHaveLength(7);

    // H24 should contain:
    // Pilots: 2, 3, 4, 5 (Pilot 1 skipped)
    // UFOs: drone1, drone2
    const h24Ids = groups.fullTracksH24.tracks.map((t) => t.id ?? t.idStr);
    expect(h24Ids).not.toContain(1);
    expect(h24Ids).toContain(2);
    expect(h24Ids).toContain(3);
    expect(h24Ids).toContain(4);
    expect(h24Ids).toContain(5);
    expect(h24Ids).toContain('aviant-drone1');
    expect(h24Ids).toContain('aviant-drone2');
    expect(groups.fullTracksH24.tracks).toHaveLength(6);

    // H12 should contain:
    // Pilots: 3, 4, 5 (Pilots 1 and 2 skipped)
    // UFOs: drone1 (drone2 skipped)
    const h12Ids = groups.fullTracksH12.tracks.map((t) => t.id ?? t.idStr);
    expect(h12Ids).not.toContain(1);
    expect(h12Ids).not.toContain(2);
    expect(h12Ids).toContain(3);
    expect(h12Ids).toContain(4);
    expect(h12Ids).toContain(5);
    expect(h12Ids).toContain('aviant-drone1');
    expect(h12Ids).not.toContain('aviant-drone2');
    expect(groups.fullTracksH12.tracks).toHaveLength(4);

    // Long incremental (20m) should contain:
    // Pilots: 4, 5 (Pilots 1, 2, 3 skipped)
    // UFOs: drone1
    const longIds = groups.longIncTracks.tracks.map((t) => t.id ?? t.idStr);
    expect(longIds).not.toContain(1);
    expect(longIds).not.toContain(2);
    expect(longIds).not.toContain(3);
    expect(longIds).toContain(4);
    expect(longIds).toContain(5);
    expect(longIds).toContain('aviant-drone1');
    expect(groups.longIncTracks.tracks).toHaveLength(3);

    // Short incremental (5m) should contain:
    // Pilots: 5 (Pilots 1, 2, 3, 4 skipped)
    // UFOs: drone1
    const shortIds = groups.shortIncTracks.tracks.map((t) => t.id ?? t.idStr);
    expect(shortIds).not.toContain(1);
    expect(shortIds).not.toContain(2);
    expect(shortIds).not.toContain(3);
    expect(shortIds).not.toContain(4);
    expect(shortIds).toContain(5);
    expect(shortIds).toContain('aviant-drone1');
    expect(groups.shortIncTracks.tracks).toHaveLength(2);

    // Flyme (share=true, max 5m, flyme fixes stripped):
    // Pilot 5 has share=true and point in last 5m -> included
    const flymeIds = groups.flymeTracks.tracks.map((t) => t.id);
    expect(flymeIds).toContain(5);
    expect(groups.flymeTracks.tracks).toHaveLength(1);
  });
});
