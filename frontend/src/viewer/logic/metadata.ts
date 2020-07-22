import Pbf from 'pbf';
import { ThunkDispatch } from 'redux-thunk';

import {
  addAirspaces,
  addGroundAltitude,
  ProtoAirspaces,
  ProtoGroundAltitude,
  ProtoMetaTrackGroup,
  RuntimeTrack,
} from '../../../../common/track';
import * as protos from '../../../../common/track_proto';
import { MapAction, receiveMetadata, setFetchingMetadata } from '../actions/map';
import { RootState } from '../store';

const FETCH_EVERY_SECONDS = 15;
export const FETCH_FOR_MINUTES = 3;

// Patch the metadata on existing tracks.
// Remove the track from idStartedOn when it has been patched.
export function patchMetadata(
  tracks: RuntimeTrack[],
  metaTracks: ArrayBuffer,
  idStartedOn: { [id: number]: number },
): RuntimeTrack[] {
  // Decode the meta groups.
  const metaGroups: ProtoMetaTrackGroup[] = (protos.MetaTracks as any)
    .read(new Pbf(metaTracks))
    .meta_track_groups_bin.map((metaGroupBin: any) => {
      return (protos.MetaTrackGroup as any).read(new Pbf(metaGroupBin));
    });
  // Patch any tack from the meta groups.
  metaGroups.forEach((metaGroup) => {
    if (metaGroup.id == -1) {
      return;
    }
    delete idStartedOn[metaGroup.id];
    // Patch the ground altitude.
    if (metaGroup.ground_altitude_group_bin) {
      const gndAltitudes: ProtoGroundAltitude[] = (protos.GroundAltitudeGroup as any).read(
        new Pbf(metaGroup.ground_altitude_group_bin),
      ).ground_altitudes;
      tracks.forEach((track) => {
        if (track.groupIndex != null && track.id == metaGroup.id) {
          addGroundAltitude(track, gndAltitudes[track.groupIndex]);
          track.isPostProcessed = true;
          tracks = [...tracks];
        }
      });
    }
    // Patch the airspaces.
    if (metaGroup.airspaces_group_bin) {
      const asp: ProtoAirspaces[] = (protos.AirspacesGroup as any).read(new Pbf(metaGroup.airspaces_group_bin))
        .airspaces;
      tracks.forEach((track) => {
        if (track.groupIndex != null && track.id == metaGroup.id) {
          addAirspaces(track, asp[track.groupIndex]);
          track.isPostProcessed = true;
          tracks = [...tracks];
        }
      });
    }
  });

  return tracks;
}

// Schedule a metadata fetch.
// The fetch will get all ids in idStartedOn.
// A fetch is automatically re-schedule when there are remaining metadata to fetch.
export function scheduleMetadataFetch(
  dispatch: ThunkDispatch<RootState, void, MapAction>,
  getState: () => RootState,
): void {
  setTimeout(() => {
    const metadata = getState().map?.metadata;
    if (metadata) {
      const ids = Object.keys(metadata.idStartedOn);
      fetch(`_metadata?ids=${ids.join(',')}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((metaTracks) => {
          dispatch(receiveMetadata(metaTracks));
          const pendingIds = Object.keys(getState().map?.metadata?.idStartedOn || {});
          if (pendingIds.length > 0) {
            scheduleMetadataFetch(dispatch, getState);
          } else {
            dispatch(setFetchingMetadata(false));
          }
        });
    }
  }, FETCH_EVERY_SECONDS * 1000);
}

// Remove out of date entries.
// Either the server has failed or is taking too long.
export function DropOutOfDateEntries(idStartedOn: { [id: number]: number }): { [id: number]: number } {
  const recentMap: { [id: number]: number } = {};
  const dropBefore = Date.now() - FETCH_FOR_MINUTES * 60 * 1000;
  for (const [id, startedOn] of Object.entries(idStartedOn)) {
    if (startedOn > dropBefore) {
      recentMap[Number(id)] = startedOn;
    }
  }
  return recentMap;
}
