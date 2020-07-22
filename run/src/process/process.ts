import async from 'async';
import * as polyline from 'google-polyline';
import Pbf from 'pbf';
import request from 'request-zero';
import simplify from 'simplify-path';

import { Keys } from '../../../app/src/keys';
import { retrieveTrackById, saveTrack, TrackEntity } from '../../../common/datastore';
import {
  diffDecodeTrack,
  diffEncodeAirspaces,
  diffEncodeArray,
  ProtoAirspaces,
  ProtoGroundAltitude,
  ProtoTrack,
  ProtoTrackGroup,
} from '../../../common/track';
import * as protos from '../../../common/track_proto';
import { fetchAirspaces } from './airspace';
import { fetchGroundAltitude } from './altitude';

// Post process a track adding metadata to it.
export async function postProcessTrack(trackId: number | string): Promise<TrackEntity | null> {
  const trackEntity = await retrieveTrackById(trackId);
  let hasErrors = false;
  if (trackEntity) {
    const trackGroupBin = trackEntity.track_group;

    if (trackGroupBin) {
      // Retrieve the tracks.
      const trackGroup: ProtoTrackGroup = (protos.TrackGroup as any).read(new Pbf(trackGroupBin));
      const tracks: ProtoTrack[] = trackGroup.tracks.map(diffDecodeTrack);

      // Add ground altitude.
      const groundAltitudes: ProtoGroundAltitude[] = await async.mapSeries(tracks, fetchGroundAltitude);
      hasErrors = hasErrors || groundAltitudes.some((proto) => proto.has_errors);
      let pbf = new Pbf();
      (protos.GroundAltitudeGroup as any).write(
        {
          ground_altitudes: groundAltitudes.map(({ altitudes, has_errors }) => ({
            altitudes: diffEncodeArray(altitudes),
            has_errors,
          })),
        },
        pbf,
      );
      trackEntity.ground_altitude_group = Buffer.from(pbf.finish());

      // Add airspaces.
      const airspaces: ProtoAirspaces[] = [];
      await async.eachOfSeries(tracks, async (track, i) => {
        airspaces.push(await fetchAirspaces(track, groundAltitudes[Number(i)]));
      });
      pbf = new Pbf();
      (protos.AirspacesGroup as any).write({ airspaces: airspaces.map(diffEncodeAirspaces) }, pbf);
      trackEntity.airspaces_group = Buffer.from(pbf.finish());

      const firstTrack = tracks[0];
      if (firstTrack != null) {
        // Add start location.
        const location = await getLocation(firstTrack);
        trackEntity.city = location.city;
        trackEntity.country = location.country;

        // Add simplified path.
        const coords = firstTrack.lat.map((lat, i) => [lat, firstTrack.lon[i]]);
        trackEntity.path = polyline.encode(simplify(coords, 0.005));
      }

      // Update the track
      trackEntity.num_postprocess = (trackEntity.num_postprocess ?? 0) + 1;
      trackEntity.has_postprocess_errors = hasErrors;
      await saveTrack(trackEntity);
    }
  }

  return trackEntity;
}

// Returns the location of the first fix in the track.
async function getLocation(track: ProtoTrack): Promise<{ city: string; country: string }> {
  const location = {
    city: '',
    country: '',
  };
  try {
    if (track.lat && track.lat.length > 0 && track.lon && track.lon.length > 0) {
      const response = await request(
        `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${track.lat[0]}&lng=${track.lon[0]}&username=${Keys.GEONAMES}`,
      );
      if (response.code == 200) {
        const loc = JSON.parse(response.body).geonames[0];
        location.city = loc?.name || '-';
        location.country = loc?.countryCode || '-';
      }
    }
  } catch (e) {
    console.error('Error retrieving the location:', e);
  }
  return location;
}
