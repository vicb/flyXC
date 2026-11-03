import { readFileSync } from 'node:fs';
import path from 'node:path';

import { diffDecodeAirspaces, diffDecodeArray, protos } from '@flyxc/common';
import * as commonNode from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import polyline from 'google-polyline';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as airspace from './airspace';
import * as altitude from './altitude';
import { postProcessTrack } from './process';

describe('postProcessTrack', () => {
  let mockDatastore: Datastore;
  let savedEntity: commonNode.TrackEntity | null = null;

  beforeEach(() => {
    savedEntity = null;
    mockDatastore = {} as unknown as Datastore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    // Mock altitude lookup to return deterministic altitudes without errors
    vi.spyOn(altitude, 'fetchGroundAltitude').mockImplementation(async (coords) => ({
      altitudes: new Array(coords.lat.length).fill(1200),
      hasErrors: false,
    }));

    // Mock airspace lookup to avoid external tile network requests
    vi.spyOn(airspace, 'fetchAirspaces').mockResolvedValue({
      activity: [0],
      bottom: [1000],
      category: [],
      endSec: [1666956000],
      flags: [1],
      hasErrors: false,
      icaoClass: [2],
      into: [true],
      name: ['CTR GENEVA'],
      startSec: [1666949000],
      top: [2000],
      type: [0],
    });

    // Stub global fetch for geonames place lookup
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('geonames.org')) {
        return new Response(
          JSON.stringify({
            geonames: [{ name: 'Chamonix', countryCode: 'FR' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await postProcessTrack(mockDatastore, '12345');

    expect(result).not.toBeNull();
    expect(savedEntity).not.toBeNull();
    expect(savedEntity?.num_postprocess).toBe(1);
    expect(savedEntity?.has_postprocess_errors).toBe(false);

    // Decode and verify ground altitude group
    expect(savedEntity?.ground_altitude_group).toBeInstanceOf(Buffer);
    const groundAltitudeGroup = protos.GroundAltitudeGroup.fromBinary(
      new Uint8Array(savedEntity!.ground_altitude_group!),
    );
    expect(groundAltitudeGroup.groundAltitudes).toHaveLength(1);
    expect(groundAltitudeGroup.groundAltitudes[0].hasErrors).toBe(false);
    const decodedAltitudes = diffDecodeArray(groundAltitudeGroup.groundAltitudes[0].altitudes);
    expect(decodedAltitudes.length).toBeGreaterThan(0);
    expect(decodedAltitudes[0]).toBe(1200);

    // Decode and verify airspaces group
    expect(savedEntity?.airspaces_group).toBeInstanceOf(Buffer);
    const airspacesGroup = protos.AirspacesGroup.fromBinary(new Uint8Array(savedEntity!.airspaces_group!));
    expect(airspacesGroup.airspaces).toHaveLength(1);
    const decodedAirspaces = diffDecodeAirspaces(airspacesGroup.airspaces[0]);
    expect(decodedAirspaces.name).toEqual(['CTR GENEVA']);
    expect(decodedAirspaces.startSec).toEqual([1666949000]);
    expect(decodedAirspaces.endSec).toEqual([1666956000]);
    expect(decodedAirspaces.bottom).toEqual([1000]);
    expect(decodedAirspaces.top).toEqual([2000]);

    // Verify location and simplified path
    expect(savedEntity?.city).toBe('Chamonix');
    expect(savedEntity?.country).toBe('FR');
    expect(savedEntity?.path).toBeDefined();
    expect(savedEntity?.path?.length).toBeGreaterThan(0);
    const decodedCoords = polyline.decode(savedEntity!.path!);
    expect(decodedCoords.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle missing track entity gracefully', async () => {
    vi.spyOn(commonNode, 'retrieveTrackById').mockResolvedValue(null);
    const result = await postProcessTrack(mockDatastore, '99999');
    expect(result).toBeNull();
  });
});
