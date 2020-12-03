import { LiveDifferentialTrackGroup, LiveTrack } from 'flyxc/common/protos/live-track';
import {
  differentialDecodeLiveTrack,
  IsSimplifiableFix,
  LIVE_MINIMAL_INTERVAL_SEC,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  simplifyLiveTrack,
} from 'flyxc/common/src/live-track';
import { getRhumbLineBearing } from 'geolib';

// Creates GeoJSON features from a live track.
//
// - Segments are created when there is a gap larger than gapMin,
// - Segments are returned as a multi-line,
// - Points are returned for all the points of interest:
//   - first and last for all the tracks,
//   - fixes with messages or emergency,
//   - 3 last fixes of the last track (last has heading),
export function trackToFeatures(track: LiveTrack, gapMin: number): any[] {
  const features: any[] = [];

  // Compute the segments

  if (track.timeSec.length > 0) {
    // A segment start at [start] and ends at [end].
    const segments: { start: number; end: number }[] = [];
    let start = 0;

    // Compute segments.
    let currentTime = track.timeSec[0];
    for (let i = 1; i < track.timeSec.length; i++) {
      const nextTime = track.timeSec[i];
      if (nextTime - currentTime > 60 * gapMin) {
        segments.push({ start, end: i - 1 });
        start = i;
      }
      currentTime = nextTime;
    }
    segments.push({ start, end: track.timeSec.length - 1 });

    const pointsByIndex = new Map<number, any>();

    // Create:
    // - a line for each segment.
    // - points for non simplifiable fixes.
    segments.forEach(({ start, end }, index) => {
      const line: [number, number, number][] = [];
      for (let i = start; i <= end; i++) {
        if (!IsSimplifiableFix(track, i, start, end)) {
          addPoint(pointsByIndex, track, i);
        }
        line.push([track.lon[i], track.lat[i], track.alt[i]]);
      }
      if (line.length > 1) {
        const properties: { [k: string]: unknown } = { id: track.id, startIndex: start, endIndex: end };
        if (index == segments.length - 1) {
          properties.last = true;
        }
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: line,
          },
          properties,
        });
      }
    });

    // Add 3 last points of the last segment.
    if (segments.length > 0) {
      const { start, end } = segments[segments.length - 1];
      let previousSec = track.timeSec[end];
      for (let i = end - 1, extraPoints = 3; i >= start && extraPoints > 0; --i) {
        const currentSec = track.timeSec[i];
        if (previousSec - currentSec >= 2 * 60) {
          previousSec = currentSec;
          addPoint(pointsByIndex, track, i);
          extraPoints--;
        }
      }
    }

    features.push(...pointsByIndex.values());
  }

  return features;
}

function addPoint(pointsByIndex: Map<number, any>, track: LiveTrack, index: number, props: any = {}): void {
  const len = track.timeSec.length;
  if (index == len - 1) {
    // Compute the heading for the last fix of last segment.
    if (len > 1) {
      const previous = { lat: track.lat[len - 2], lon: track.lon[len - 2] };
      const current = { lat: track.lat[len - 1], lon: track.lon[len - 1] };
      props.heading = Math.round(getRhumbLineBearing(previous, current));
    } else {
      props.heading = 0;
    }
    props.isLast = true;
  }
  pointsByIndex.set(index, {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [track.lon[index], track.lat[index], track.alt[index]],
    },
    properties: {
      ...props,
      id: track.id,
      index,
    },
  });
}

// Handles the live track updates from the server.
//
// For full (i.e. not incremental updates) the track received from the server are returned.
//
// For incremental updates, the updates are merged with the tracks and old fixes are removed.
// The returned tracks contain the updated tracks and the old tracks that still have some fixes.
export function updateLiveTracks(
  tracks: { [id: string]: LiveTrack },
  updates: LiveDifferentialTrackGroup,
  dropBeforeSec = Date.now(),
): LiveTrack[] {
  // Tracks received from the server (either full or incremental).
  const serverTracks: { [id: string]: LiveTrack } = {};
  const mergedTracks: { [id: string]: LiveTrack } = {};

  updates.tracks.forEach((diffTrack) => {
    serverTracks[diffTrack.id] = differentialDecodeLiveTrack(diffTrack);
  });

  if (updates.incremental) {
    // Update the current tracks by:
    // - patching the deltas,
    // - removing old points,
    // - deleting processed tracks from the server tracks.
    for (const id of Object.keys(tracks)) {
      let track = tracks[id] as LiveTrack;
      if (!track) {
        continue;
      }
      if (id in serverTracks) {
        track = mergeLiveTracks(track, serverTracks[id]);
        simplifyLiveTrack(track, LIVE_MINIMAL_INTERVAL_SEC);
        delete serverTracks[id];
      }
      track = removeBeforeFromLiveTrack(track, dropBeforeSec);
      if (track.timeSec.length) {
        mergedTracks[id] = track;
      }
    }
  }

  return Object.values({ ...mergedTracks, ...serverTracks });
}
