// Process the live tracking info from the server.

import { LIVE_RETENTION_FLIGHT_MODE_SEC, LIVE_RETENTION_SEC, protos, TRACK_GAP_MIN } from '@flyxc/common';

import { trackToFeatures, updateLiveTracks } from '../logic/live-track';

export interface Request {
  buffer: ArrayBuffer;
  flightMode: boolean;
  tracks: { [id: string]: protos.LiveTrack };
}

export interface Response {
  tracks: protos.LiveTrack[];
  geojson: any;
}

const w: Worker = self as any;

w.addEventListener('message', (message: MessageEvent<Request>) => {
  const request = message.data;
  const updates = protos.LiveDifferentialTrackGroup.fromBinary(new Uint8Array(request.buffer));

  const dropBeforeSec = Date.now() / 1000 - (request.flightMode ? LIVE_RETENTION_FLIGHT_MODE_SEC : LIVE_RETENTION_SEC);

  const tracks: protos.LiveTrack[] = updateLiveTracks(request.tracks, updates, dropBeforeSec);
  const features: any[] = [];

  for (const track of tracks) {
    features.push(...trackToFeatures(track, TRACK_GAP_MIN));
  }

  w.postMessage({ tracks, geojson: { type: 'FeatureCollection', features } });
});
