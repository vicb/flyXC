import { LatLon, LatLonZ } from '@flyxc/common';

// Adds the ground elevation to the list of points.
//
// The function use the google maps elevation service.
export async function addAltitude(points: LatLon[]): Promise<LatLonZ[]> {
  const withZ = points.map((p) => ({ ...p, alt: 0 }));

  const locations = points.map((p) => new google.maps.LatLng(p.lat, p.lon));
  const elevator = new google.maps.ElevationService();

  try {
    // any is required because the Promise API is not in the types.
    const { results }: { results: any[] } = await (elevator as any).getElevationForLocations({ locations });
    results.forEach(({ elevation }, i) => {
      withZ[i].alt = Math.round(elevation);
    });
  } catch (e) {
    // empty
  }

  return withZ;
}
