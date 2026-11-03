import { readFileSync } from 'node:fs';
import path from 'node:path';

import { protos } from '@flyxc/common';
import * as commonNode from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postProcessTrack } from './process';

describe('postProcessTrack', () => {
  let mockDatastore: Datastore;
  let savedEntity: commonNode.TrackEntity | null = null;

  beforeEach(() => {
    savedEntity = null;
    mockDatastore = {} as unknown as Datastore;
  });

  it('should post-process a track entity without hanging and populate metadata', async () => {
    const pbf = readFileSync(path.join(__dirname, 'fixtures', '570kms.pbf'));
    const { metaTrackGroups } = protos.MetaTrackGroupsAndRoute.fromBinary(new Uint8Array(pbf));
    const trackGroupBin = Buffer.from(metaTrackGroups[0].trackGroupBin!);

    const initialEntity: commonNode.TrackEntity = {
      created: new Date(),
      track_group: trackGroupBin,
    };

    vi.spyOn(commonNode, 'retrieveTrackById').mockResolvedValue(initialEntity);
    vi.spyOn(commonNode, 'saveTrack').mockImplementation(async (_ds, entity) => {
      savedEntity = entity;
      return 1;
    });

    const result = await postProcessTrack(mockDatastore, '12345');

    expect(result).not.toBeNull();
    expect(savedEntity).not.toBeNull();
    expect(savedEntity?.num_postprocess).toBe(1);
    expect(savedEntity?.has_postprocess_errors).toBe(false);
    expect(savedEntity?.ground_altitude_group).toBeInstanceOf(Buffer);
    expect(savedEntity?.ground_altitude_group?.length).toBeGreaterThan(0);
    expect(savedEntity?.airspaces_group).toBeInstanceOf(Buffer);
    expect(savedEntity?.airspaces_group?.length).toBeGreaterThan(0);
    expect(savedEntity?.path).toBeDefined();
    expect(savedEntity?.city).toBeDefined();
    expect(savedEntity?.country).toBeDefined();
  }, 30000);

  it('should handle missing track entity gracefully', async () => {
    vi.spyOn(commonNode, 'retrieveTrackById').mockResolvedValue(null);
    const result = await postProcessTrack(mockDatastore, '99999');
    expect(result).toBeNull();
  });
});
