import computeDestinationPoint from 'geolib/es/computeDestinationPoint';

export class ClosingSector {
  center: { lat: number; lon: number } | null = null;
  radius: number | null = null;
  poly: google.maps.Polygon;

  constructor() {
    this.poly = new google.maps.Polygon({
      fillColor: '#ffff00',
      fillOpacity: 0.3,
      strokeColor: '#ffff00',
      strokeOpacity: 0.5,
      strokeWeight: 1,
      zIndex: 40,
    });
  }

  setMap(map: google.maps.Map | null): void {
    this.poly.setMap(map);
  }

  addListener(name: string, handler: (...args: any[]) => void): google.maps.MapsEventListener {
    return this.poly.addListener(name, handler);
  }

  update(): void {
    if (this.center == null || this.radius == null) {
      return;
    }
    const path: { latitude: number; longitude: number }[] = [{ latitude: this.center.lat, longitude: this.center.lon }];
    for (let i = 0; i <= 360; i += 10) {
      path.push(computeDestinationPoint(this.center, this.radius, i));
    }
    this.poly.setPath(path.map(({ latitude, longitude }) => new google.maps.LatLng(latitude, longitude)));
  }
}
