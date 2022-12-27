import { protos } from '@flyxc/common';

// Parse a GeoJson track to a proto message.
export function parseGeoJson(geojson: any): protos.Track[] {
  if (geojson.type != 'FeatureCollection') {
    return [];
  }

  const tracks: protos.Track[] = [];

  for (const feature of geojson.features) {
    const type = feature.geometry.type;
    if (type == 'LineString' || type == 'MultiLineString') {
      const lat: number[] = [];
      const lon: number[] = [];
      const alt: number[] = [];
      const timeSec: number[] = [];

      const coords =
        feature.geometry.type == 'LineString'
          ? feature.geometry.coordinates
          : [].concat(...feature.geometry.coordinates);
      let times: number[];
      if (feature.properties.coordTimes) {
        times = [].concat(feature.properties.coordTimes).map((t) => Math.round(new Date(t).getTime() / 1000));
      } else {
        times = fakeTime(coords.length);
      }
      coords.forEach((c: number[], i: number) => {
        lon.push(c[0]);
        lat.push(c[1]);
        alt.push(c[2] || 0);
        timeSec.push(times[i]);
      });
      tracks.push({ pilot: geojson.name || 'unknown', lat, lon, alt, timeSec });
    }
  }

  return tracks;
}

// Creates fake timestamps to be added to tracks without time information.
// The series starts on 2000-01-01 and each fix is separated by 10s.
function fakeTime(length: number): number[] {
  const fakeTimes: number[] = [];
  let timeSec = Math.round(new Date(2000, 0, 1).getTime() / 1000);
  for (let i = 0; i < length; i++) {
    fakeTimes.push(timeSec);
    timeSec += 10;
  }
  return fakeTimes;
}
