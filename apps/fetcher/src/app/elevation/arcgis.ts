import type { LatLon } from '@flyxc/common';

// URL of the elevation service.
//
// Set MaximumSampleDistance to more than earth circumference to avoid interpolation.
// `{geometry}` must be replace with a JSON esriGeometryPolyline.
//
// {
//   "geometryType":"esriGeometryPolyline",
//   "features":[{
//     "geometry":{
//        "paths":[[
//          [52.50, 13.30],
//          [lon, lat], ...
//        ]],
//        "spatialReference":{ "wkid":4326 }
//     }
//   }]
// }
//
// Actual locations are interleaved with dummy locations as otherwise some locations might get skipped if they are too
// close to each other.
//
// see: https://developers.arcgis.com/rest/elevation/api-reference/profilesync.htm
const PROFILE_URL = `https://elevation.arcgis.com/arcgis/rest/services/Tools/ElevationSync/GPServer/Profile/execute?f=json&DEMResolution=FINEST&MaximumSampleDistance=99999&MaximumSampleDistanceUnits=Kilometers&returnZ=true&InputLineFeatures={geometry}`;

const MAX_POINT = 200;

export function getElevationUrl(points: LatLon[]): string {
  const geometry = {
    geometryType: 'esriGeometryPolyline',
    features: [
      {
        geometry: {
          paths: [
            points.slice(0, MAX_POINT).flatMap((ll) => [
              [ll.lon, ll.lat],
              [-15, -15],
            ]),
          ],
          spatialReference: { wkid: 4326 },
        },
      },
    ],
  };

  return PROFILE_URL.replace('{geometry}', encodeURIComponent(JSON.stringify(geometry)));
}

// Parses the result of the elevation service and returns an array of altitude in meters.
//
// Notes:
// - The parsing skips the dummy location,
// - Throws if the returned locations are too far apart from the requested locations.
//
// Shape of the result:
// {
//   results: [
//     {
//       paramName: 'OutputProfile',
//       dataType: 'GPFeatureRecordSetLayer',
//       value: {
//         displayFieldName: '',
//         hasZ: true,
//         geometryType: 'esriGeometryPolyline',
//         spatialReference: {
//           wkid: 4326,
//           latestWkid: 4326,
//         },
//         fields: [ ... ]
//         features: [
//           {
//             attributes: { ... },
//             geometry: {
//               hasZ: true,
//               paths: [
//                 [
//                   [-118.29256296157814, 36.578299473962772, 4400.2636000000057],
//                   [6.8651783474269337, 45.832679109920036, 4785.0957999999955],
//                 ],
//               ],
//             },
//           },
//         ],
//         exceededTransferLimit: false,
//       },
//     },
// ],
// messages: [],
// };
export function parseElevationResponse(json: any, points: LatLon[]): number[] {
  const result = json.results[0].value.features[0].geometry.paths[0];
  if (!Array.isArray(result)) {
    throw new Error('Error parsing json');
  }
  const elevations: number[] = [];
  for (let i = 0; 2 * i < result.length && i < points.length; i++) {
    const [lon, lat, alt] = result[2 * i];
    if (Math.abs(lon - points[i].lon) > 0.1 || Math.abs(lat - points[i].lat) > 0.1) {
      throw new Error('Invalid response');
    }
    elevations.push(Math.round(alt));
  }
  return elevations;
}
