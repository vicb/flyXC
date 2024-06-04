export class ClosingSector {
  center: { lat: number; lon: number } | null = null;
  radius: number | null = null;
  circle: google.maps.Circle;

  constructor() {
    this.circle = new google.maps.Circle({
      fillColor: '#ffff00',
      fillOpacity: 0.3,
      strokeColor: '#ffff00',
      strokeOpacity: 0.5,
      strokeWeight: 1,
      zIndex: 40,
    });
  }

  setMap(map?: google.maps.Map | null): void {
    this.circle.setMap(map ?? null);
  }

  addListener(name: string, handler: (...args: any[]) => void): google.maps.MapsEventListener {
    return this.circle.addListener(name, handler);
  }

  update(): void {
    if (this.center == null || this.radius == null) {
      return;
    }
    this.circle.setCenter({ lat: this.center.lat, lng: this.center.lon });
    this.circle.setRadius(this.radius);
  }
}
