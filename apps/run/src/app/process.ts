import { diffDecodeTrack, diffEncodeAirspaces, diffEncodeArray32bit, fetchResponse, protos } from '@flyxc/common';
import type { TrackEntity } from '@flyxc/common-node';
import { retrieveTrackById, saveTrack } from '@flyxc/common-node';
import type { Datastore } from '@google-cloud/datastore';
import async from 'async';
import * as polyline from 'google-polyline';
import simplify from 'simplify-path';

import { fetchAirspaces } from './airspace';
import { fetchGroundAltitude } from './altitude';

// Post process a track adding metadata to it.
export async function postProcessTrack(datastore: Datastore, trackId: number | string): Promise<TrackEntity | null> {
  const trackEntity = await retrieveTrackById(datastore, trackId);
  let hasErrors = false;
  if (trackEntity) {
    const trackGroupBin = trackEntity.track_group;

    if (trackGroupBin) {
      // Retrieve the tracks.
      const trackGroup: protos.TrackGroup = protos.TrackGroup.fromBinary(new Uint8Array(trackGroupBin));
      const tracks: protos.Track[] = trackGroup.tracks.map((t) => diffDecodeTrack(t));

      tracks.forEach((track) => {
        track.timeSec = track.timeSec.map((t) => Math.min(t, 2 ** 31 - 1));
      });

      // Add ground altitude.
      const groundAltitudes: protos.GroundAltitude[] = await async.mapSeries(tracks, fetchGroundAltitude);
      hasErrors = hasErrors || groundAltitudes.some((proto) => proto.hasErrors);

      trackEntity.ground_altitude_group = Buffer.from(
        protos.GroundAltitudeGroup.toBinary({
          groundAltitudes: groundAltitudes.map(({ altitudes, hasErrors }) => ({
            altitudes: diffEncodeArray32bit(altitudes),
            hasErrors,
          })),
        }),
      );

      // Add airspaces.
      const airspaces: protos.Airspaces[] = [];
      await async.eachOfSeries(tracks, async (track, i) => {
        airspaces.push(await fetchAirspaces(track, groundAltitudes[Number(i)]));
      });
      trackEntity.airspaces_group = Buffer.from(
        protos.AirspacesGroup.toBinary({ airspaces: airspaces.map(diffEncodeAirspaces) }),
      );

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
      await saveTrack(datastore, trackEntity);
    }
  }

  return trackEntity;
}

// Returns the location of the first fix in the track.
async function getLocation(track: protos.Track): Promise<{ city: string; country: string }> {
  const location = {
    city: '',
    country: '',
  };
  try {
    if (track.lat && track.lat.length > 0 && track.lon && track.lon.length > 0) {
      const response = await fetchResponse(
        `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${track.lat[0]}&lng=${track.lon[0]}&username=${SECRETS.GEONAMES}`,
        {
          retry: 3,
          timeoutS: 5,
          retryOnTimeout: true,
        },
      );
      if (response.ok) {
        const loc = (await response.json()).geonames[0];
        location.city = loc?.name ?? '-';
        location.country = loc?.countryCode ?? '-';
      }
    }
  } catch (e) {
    console.error('Error retrieving the location:', e);
  }
  return location;
}
