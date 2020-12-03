// Process the live tracking info from the server.

import { LiveDifferentialTrackGroup, LiveTrack } from 'flyxc/common/protos/live-track';
import { LIVE_RETENTION_SEC, TRACK_GAP_MIN } from 'flyxc/common/src/live-track';

import { trackToFeatures, updateLiveTracks } from '../logic/live-track';

export interface Request {
  buffer: ArrayBuffer;
  tracks: { [id: string]: LiveTrack };
}

export interface Response {
  tracks: LiveTrack[];
  geojson: any;
}

const w: Worker = self as any;

w.addEventListener('message', (message: MessageEvent<Request>) => {
  const updates = LiveDifferentialTrackGroup.fromBinary(new Uint8Array(message.data.buffer));

  const dropBeforeSec = Date.now() / 1000 - LIVE_RETENTION_SEC;

  const tracks: LiveTrack[] = updateLiveTracks(message.data.tracks, updates, dropBeforeSec);
  const features: any[] = [];

  for (const track of tracks) {
    features.push(...trackToFeatures(track, TRACK_GAP_MIN));
  }

  w.postMessage({ tracks, geojson: { type: 'FeatureCollection', features } });
});
