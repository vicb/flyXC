import { customElement, LitElement, property, PropertyValues } from 'lit-element';

import { RuntimeTrack } from '../../../../common/track';
import { trackColor } from '../logic/map';

const INACTIVE_OPACITY = 0.7;

@customElement('gm-line')
export class GmLineElement extends LitElement {
  @property()
  map: google.maps.Map | null = null;

  @property()
  track: RuntimeTrack | null = null;

  @property()
  active = false;

  @property()
  index = 0;

  line: google.maps.Polyline | null = null;
  maskLine: google.maps.Polyline | null = null;

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.map && this.track) {
      const path: { lat: number; lng: number }[] = [];
      const track = this.track;
      track.fixes.lat.forEach((lat, i) => {
        path.push({
          lat,
          lng: track.fixes.lon[i],
        });
      });

      if (!this.maskLine) {
        this.maskLine = new google.maps.Polyline({
          map: this.map,
          strokeColor: '#fff',
          strokeOpacity: 0.6,
          strokeWeight: 6,
        });
      }

      this.maskLine.setPath(path);

      if (!this.line) {
        this.line = new google.maps.Polyline({
          map: this.map,
          strokeOpacity: 1.0,
          strokeWeight: 2,
        });
      }

      this.line.setOptions({
        strokeColor: trackColor(this.index),
        strokeOpacity: this.active ? 1 : INACTIVE_OPACITY,
      });
      this.line.setPath(path);
    }

    return false;
  }

  disconnectedCallback(): void {
    if (this.line) {
      this.line.setMap(null);
      this.line = null;
    }
    if (this.maskLine) {
      this.maskLine.setMap(null);
      this.maskLine = null;
    }
  }
}
