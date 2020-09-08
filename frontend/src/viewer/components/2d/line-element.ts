import { customElement, LitElement, property } from 'lit-element';

import { RuntimeTrack } from '../../../../../common/track';
import { trackColor } from '../../logic/tracks';

const INACTIVE_OPACITY = 0.5;

@customElement('line-element')
export class LineElement extends LitElement {
  @property()
  map: google.maps.Map | undefined;

  @property()
  track?: RuntimeTrack;

  @property()
  active = false;

  @property()
  index = 0;

  private line: google.maps.Polyline | null = null;
  private maskLine: google.maps.Polyline | null = null;

  shouldUpdate(): boolean {
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
          clickable: false,
          map: this.map,
          strokeColor: '#fff',
          strokeOpacity: 0.6,
          strokeWeight: 6,
        });
      }

      this.maskLine.setPath(path);

      if (!this.line) {
        this.line = new google.maps.Polyline({
          clickable: false,
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

  // There is not content - no need to create a shadow root.
  createRenderRoot(): Element {
    return this;
  }

  disconnectedCallback(): void {
    this.line?.setMap(null);
    this.line = null;
    this.maskLine?.setMap(null);
    this.maskLine = null;
  }
}
