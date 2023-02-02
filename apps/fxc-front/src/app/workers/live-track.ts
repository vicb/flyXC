// Process the live tracking info from the server.

import {
  isUfo,
  LIVE_FLIGHT_MODE_RETENTION_SEC,
  LIVE_TRACKER_RETENTION_SEC,
  LIVE_UFO_RETENTION_SEC,
  protos,
  removeBeforeFromLiveTrack,
  TRACK_GAP_MIN,
} from '@flyxc/common';

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

  const updatedTracks = updateLiveTracks(request.tracks, updates);
  const tracks: protos.LiveTrack[] = [];
  const features: any[] = [];

  const retentionSec = request.flightMode ? LIVE_FLIGHT_MODE_RETENTION_SEC : LIVE_TRACKER_RETENTION_SEC;
  const now = Math.round(Date.now() / 1000);

  for (let track of updatedTracks) {
    const dropBeforeSec = now - (isUfo(track.flags[0]) ? LIVE_UFO_RETENTION_SEC : retentionSec);
    track = removeBeforeFromLiveTrack(track, dropBeforeSec);

    if (track.timeSec.length > 0) {
      tracks.push(track);
      features.push(...trackToFeatures(track, TRACK_GAP_MIN));
    }
  }

  w.postMessage({ tracks, geojson: { type: 'FeatureCollection', features } });
});
