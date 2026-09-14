import { differentialEncodeLiveTrack, LiveTrackDurationSec, protos, removeBeforeFromLiveTrack } from '@flyxc/common';

/**
 * Represents groups of live tracks categorized by their retention windows.
 */
export interface LiveTrackGroups {
  incM5: protos.LiveDifferentialTrackGroup;
  incM20: protos.LiveDifferentialTrackGroup;
  partnersM30: protos.LiveDifferentialTrackGroup;
  fullH12: protos.LiveDifferentialTrackGroup;
  fullH24: protos.LiveDifferentialTrackGroup;
  fullH48: protos.LiveDifferentialTrackGroup;
}

/**
 * Converts a serialized protobuf Uint8Array payload into a zero-copy Node.js Buffer view.
 */
export function protoToBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Conditionally adds a live track to a track group after removing outdated points.
 *
 * NOTE: pilots use numerical ids while UFOs use string ids.
 *
 * @param dstTracks - The destination track group to potentially add the track to.
 * @param srcTrack - The live track to be processed and potentially added.
 * @param historySec - The number of seconds of history to keep.
 * @param id - The identifier for the track.
 * @param name - The name associated with the track.
 * @param nowSec - Current timestamp in seconds.
 * @returns The processed live track after removing outdated points.
 */
export function maybePushTrack(
  dstTracks: protos.LiveDifferentialTrackGroup,
  srcTrack: protos.LiveTrack,
  historySec: number,
  id: number | string,
  name?: string,
  nowSec = Math.round(Date.now() / 1000),
): protos.LiveTrack {
  if (srcTrack.timeSec.length === 0) {
    return srcTrack;
  }
  const dropBeforeSec = nowSec - historySec;
  srcTrack = removeBeforeFromLiveTrack(srcTrack, dropBeforeSec);
  if (srcTrack.timeSec.length > 0) {
    dstTracks.tracks.push(differentialEncodeLiveTrack(srcTrack, id, name));
  }
  return srcTrack;
}

/**
 * Creates differential live track groups for pilots and UFOs.
 *
 * Note: This function assumes that `pilot.track` does not exceed the retention window of FullH48.
 */
export function createLiveTrackGroups(
  state: protos.FetcherState,
  nowSec = Math.round(Date.now() / 1000),
): LiveTrackGroups {
  const trackGroups = {
    incM5: protos.LiveDifferentialTrackGroup.create(),
    incM20: protos.LiveDifferentialTrackGroup.create(),
    partnersM30: protos.LiveDifferentialTrackGroup.create(),
    fullH12: protos.LiveDifferentialTrackGroup.create(),
    fullH24: protos.LiveDifferentialTrackGroup.create(),
    fullH48: protos.LiveDifferentialTrackGroup.create(),
  };

  // Add pilots.
  for (const pilotId in state.pilots) {
    const pilot = state.pilots[pilotId];
    if (pilot.track.timeSec.length === 0) {
      continue;
    }
    // Pilots use numerical ids, UFOs use string ids.
    const pilotIdNum = Number(pilotId);
    const name = pilot.name || 'unknown';

    trackGroups.fullH48.tracks.push(differentialEncodeLiveTrack(pilot.track, pilotIdNum, name));

    const fullH24 = maybePushTrack(
      trackGroups.fullH24,
      pilot.track,
      LiveTrackDurationSec.H24,
      pilotIdNum,
      name,
      nowSec,
    );
    const fullH12 = maybePushTrack(trackGroups.fullH12, fullH24, LiveTrackDurationSec.H12, pilotIdNum, name, nowSec);
    if (pilot.share) {
      maybePushTrack(trackGroups.partnersM30, fullH12, LiveTrackDurationSec.PartnersM30, pilotIdNum, name, nowSec);
    }
    const incM20 = maybePushTrack(trackGroups.incM20, fullH12, LiveTrackDurationSec.M20, pilotIdNum, name, nowSec);
    maybePushTrack(trackGroups.incM5, incM20, LiveTrackDurationSec.M5, pilotIdNum, name, nowSec);
  }

  // Add UFOs.
  for (const name in state.ufoFleets) {
    const fleet = state.ufoFleets[name];
    if (!fleet?.ufos) {
      continue;
    }
    for (const ufoId in fleet.ufos) {
      const track = fleet.ufos[ufoId];
      if (track.timeSec.length === 0) {
        continue;
      }
      const ufoIdStr = `${name}-${ufoId}`;
      trackGroups.fullH48.tracks.push(differentialEncodeLiveTrack(track, ufoIdStr));

      const fullH24 = maybePushTrack(trackGroups.fullH24, track, LiveTrackDurationSec.H24, ufoIdStr, undefined, nowSec);
      const fullH12 = maybePushTrack(
        trackGroups.fullH12,
        fullH24,
        LiveTrackDurationSec.H12,
        ufoIdStr,
        undefined,
        nowSec,
      );
      const incM20 = maybePushTrack(trackGroups.incM20, fullH12, LiveTrackDurationSec.M20, ufoIdStr, undefined, nowSec);
      maybePushTrack(trackGroups.incM5, incM20, LiveTrackDurationSec.M5, ufoIdStr, undefined, nowSec);
    }
  }

  return trackGroups;
}
