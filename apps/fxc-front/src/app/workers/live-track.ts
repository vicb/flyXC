// Process the live tracking info from the server.

import {
  isUfo,
  LIVE_RETENTION_FLIGHT_MODE_SEC,
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

  const tracks: protos.LiveTrack[] = updateLiveTracks(request.tracks, updates);
  const features: any[] = [];

  for (let track of tracks) {
    if (track.timeSec.length == 0) {
      continue;
    }
    let dropBeforeSec = LIVE_TRACKER_RETENTION_SEC;
    if (request.flightMode) {
      dropBeforeSec = LIVE_RETENTION_FLIGHT_MODE_SEC;
    } else if (isUfo(track.flags[0])) {
      dropBeforeSec = LIVE_UFO_RETENTION_SEC;
    }
    track = removeBeforeFromLiveTrack(track, dropBeforeSec);
    if (track.timeSec.length) {
      features.push(...trackToFeatures(track, TRACK_GAP_MIN));
    }
  }

  w.postMessage({ tracks, geojson: { type: 'FeatureCollection', features } });
});
