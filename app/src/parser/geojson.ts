import { Track } from 'flyxc/common/protos/track';

// Parse a GeoJson track to a proto message.
export function parseGeoJson(geojson: any): Track[] {
  if (geojson.type != 'FeatureCollection') {
    return [];
  }

  const tracks: Track[] = [];

  for (const feature of geojson.features) {
    const type = feature.geometry.type;
    if (type == 'LineString' || type == 'MultiLineString') {
      const lat: number[] = [];
      const lon: number[] = [];
      const alt: number[] = [];
      const ts: number[] = [];

      const coords =
        feature.geometry.type == 'LineString'
          ? feature.geometry.coordinates
          : [].concat(...feature.geometry.coordinates);
      let times: number[];
      if (feature.properties.coordTimes) {
        times = [].concat(feature.properties.coordTimes).map((t) => new Date(t).getTime());
      } else {
        times = fakeTime(coords.length);
      }
      coords.forEach((c: number[], i: number) => {
        lon.push(c[0]);
        lat.push(c[1]);
        alt.push(c[2] || 0);
        ts.push(times[i]);
      });
      tracks.push({ pilot: geojson.name || 'unknown', lat, lon, alt, ts });
    }
  }

  return tracks;
}

// Creates fake timestamps to be added to tracks without time information.
// The series starts on 2000-01-01 and each fix is separated by 10s.
function fakeTime(length: number): number[] {
  const fakeTimes: number[] = [];
  let time = new Date(2000, 0, 1).getTime();
  for (let i = 0; i < length; i++) {
    fakeTimes.push(time);
    time += 10000;
  }
  return fakeTimes;
}
