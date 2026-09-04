import {
  differentialEncodeLiveTrack,
  LiveDataRetentionSec,
  protos,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
} from '@flyxc/common';

export interface LiveTrackGroups {
  fullTracksH12: protos.LiveDifferentialTrackGroup;
  fullTracksH24: protos.LiveDifferentialTrackGroup;
  fullTracksH48: protos.LiveDifferentialTrackGroup;
  longIncTracks: protos.LiveDifferentialTrackGroup;
  shortIncTracks: protos.LiveDifferentialTrackGroup;
  flymeTracks: protos.LiveDifferentialTrackGroup;
}

/**
 * Conditionally adds a live track to a track group after removing outdated points.
 *
 * NOTE: pilots use numerical ids while UFOs use string ids.
 *
 * @param dstTracks - The destination track group to potentially add the track to.
 * @param track - The live track to be processed and potentially added.
 * @param historySec - The number of seconds of history to keep.
 * @param id - The identifier for the track.
 * @param name - The name associated with the track.
 * @param nowSec - Current timestamp in seconds.
 * @returns The processed live track after removing outdated points.
 */
export function maybePushTrack(
  dstTracks: protos.LiveDifferentialTrackGroup,
  track: protos.LiveTrack,
  historySec: number,
  id: number | string,
  name?: string,
  nowSec = Math.round(Date.now() / 1000),
): protos.LiveTrack {
  if (track.timeSec.length === 0) {
    return track;
  }
  const dropBeforeSec = nowSec - historySec;
  track = removeBeforeFromLiveTrack(track, dropBeforeSec);
  if (track.timeSec.length > 0) {
    dstTracks.tracks.push(differentialEncodeLiveTrack(track, id, name));
  }
  return track;
}

/**
 * Creates differential live track groups for pilots and UFOs.
 *
 * Cascading optimization:
 * Since retention windows are strictly decreasing:
 * FullH48 (48h) > FullH24 (24h) > FullH12 (12h) > IncrementalLong (20m) > IncrementalShort (5m)
 * if an outer window yields an empty track, all downstream inner windows are guaranteed
 * to be empty as well and are short-circuited.
 */
export function createLiveTrackGroups(
  state: protos.FetcherState,
  nowSec = Math.round(Date.now() / 1000),
): LiveTrackGroups {
  const fullTracksH12 = protos.LiveDifferentialTrackGroup.create();
  const fullTracksH24 = protos.LiveDifferentialTrackGroup.create();
  const fullTracksH48 = protos.LiveDifferentialTrackGroup.create();
  const longIncTracks = protos.LiveDifferentialTrackGroup.create({ incremental: true });
  const shortIncTracks = protos.LiveDifferentialTrackGroup.create({ incremental: true });
  const flymeTracks = protos.LiveDifferentialTrackGroup.create();

  // Add pilots.
  for (const [pilotId, pilot] of Object.entries(state.pilots)) {
    // Pilots use numerical ids, UFOs use string ids.
    const pilotIdNum = Number(pilotId);
    const name = pilot.name || 'unknown';

    if (pilot.track.timeSec.length > 0) {
      fullTracksH48.tracks.push(differentialEncodeLiveTrack(pilot.track, pilotIdNum, name));

      const fullH24 = maybePushTrack(
        fullTracksH24,
        pilot.track,
        LiveDataRetentionSec.FullH24,
        pilotIdNum,
        name,
        nowSec,
      );
      if (fullH24.timeSec.length > 0) {
        const fullH12 = maybePushTrack(fullTracksH12, fullH24, LiveDataRetentionSec.FullH12, pilotIdNum, name, nowSec);
        if (fullH12.timeSec.length > 0) {
          const longInc = maybePushTrack(
            longIncTracks,
            fullH12,
            LiveDataRetentionSec.IncrementalLong,
            pilotIdNum,
            name,
            nowSec,
          );
          if (longInc.timeSec.length > 0) {
            maybePushTrack(shortIncTracks, longInc, LiveDataRetentionSec.IncrementalShort, pilotIdNum, name, nowSec);
          }

          if (pilot.share) {
            const flymeTrack = removeDeviceFromLiveTrack(fullH12, 'flyme');
            maybePushTrack(flymeTracks, flymeTrack, LiveDataRetentionSec.ExportToPartners, pilotIdNum, name, nowSec);
          }
        }
      }
    }
  }

  // Add UFOs.
  for (const [name, fleet] of Object.entries(state.ufoFleets)) {
    for (const [ufoId, track] of Object.entries(fleet.ufos)) {
      const ufoIdStr = `${name}-${ufoId}`;
      if (track.timeSec.length > 0) {
        fullTracksH48.tracks.push(differentialEncodeLiveTrack(track, ufoIdStr));

        const fullH24 = maybePushTrack(fullTracksH24, track, LiveDataRetentionSec.FullH24, ufoIdStr, undefined, nowSec);
        if (fullH24.timeSec.length > 0) {
          const fullH12 = maybePushTrack(
            fullTracksH12,
            fullH24,
            LiveDataRetentionSec.FullH12,
            ufoIdStr,
            undefined,
            nowSec,
          );
          if (fullH12.timeSec.length > 0) {
            const longInc = maybePushTrack(
              longIncTracks,
              fullH12,
              LiveDataRetentionSec.IncrementalLong,
              ufoIdStr,
              undefined,
              nowSec,
            );
            if (longInc.timeSec.length > 0) {
              maybePushTrack(
                shortIncTracks,
                longInc,
                LiveDataRetentionSec.IncrementalShort,
                ufoIdStr,
                undefined,
                nowSec,
              );
            }
          }
        }
      }
    }
  }

  return {
    fullTracksH12,
    fullTracksH24,
    fullTracksH48,
    longIncTracks,
    shortIncTracks,
    flymeTracks,
  };
}
