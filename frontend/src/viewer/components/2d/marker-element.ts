import { LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import { formatUnit, Units } from '../../logic/units';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { setCurrentTrackId } from '../../redux/track-slice';

const INACTIVE_OPACITY = 0.5;

@customElement('marker-element')
export class MarkerElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @property()
  timestamp = 0;
  @property({ attribute: false })
  track?: RuntimeTrack;

  @internalProperty()
  active = false;
  @internalProperty()
  private units?: Units;
  @internalProperty()
  private displayLabels = true;
  @internalProperty()
  private color = '';

  private tsOffset = 0;
  private marker?: google.maps.Marker;
  private icon?: google.maps.Symbol;

  stateChanged(state: RootState): void {
    if (this.track) {
      const id = this.track.id;
      this.tsOffset = sel.tsOffsets(state)[id];
      this.color = sel.trackColors(state)[id];
      this.active = sel.currentTrackId(state) == id;
    }
    this.units = state.units;
    this.displayLabels = state.track.displayLabels;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyMarker();
  }

  private destroyMarker(): void {
    this.marker?.setMap(null);
    this.marker = undefined;
    this.icon = undefined;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.map == null) {
      this.destroyMarker();
      return false;
    }
    if (changedProps.has('map') || changedProps.has('track')) {
      this.destroyMarker();
      this.maybeCreateMarker();
    }
    if (this.marker && this.icon && this.track) {
      const timestamp = this.timestamp + this.tsOffset;
      const { lat, lon, alt } = sel.getTrackLatLonAlt(store.getState())(timestamp, this.track) as LatLonZ;
      const scale = (50 * ((alt ?? 0) - this.track.minAlt)) / (this.track.maxAlt - this.track.minAlt) + 20;
      this.marker.setPosition({ lat, lng: lon });
      const icon = this.icon as google.maps.Symbol;
      icon.fillColor = this.color;
      icon.fillOpacity = this.active ? 1 : INACTIVE_OPACITY;
      icon.strokeColor = this.active ? '#000' : '#555';
      icon.scale = scale / 512;
      this.marker.setIcon(icon);
      // Display higher markers on top.
      this.marker.setZIndex(Math.floor(alt ?? 0));
      if (this.displayLabels) {
        const altitude = `${formatUnit(alt ?? 0, this.units?.altitude)}`;
        this.marker.setLabel({
          color: this.active ? '#000' : '#555',
          fontWeight: '500',
          className: 'gm-label-outline',
          text: (this.track.name == 'unknown' ? '' : `${this.track.name} · `) + altitude,
        } as any);
      } else {
        this.marker.setLabel('');
      }
    }

    return false;
  }

  // Creates the marker when there is a track.
  private maybeCreateMarker() {
    if (this.track == null) {
      return;
    }

    this.marker = new google.maps.Marker({
      map: this.gMap,
      clickable: true,
      title: this.track.name,
    });

    google.maps.event.addListener(this.marker, 'click', () => {
      store.dispatch(setCurrentTrackId(this.track?.id));
    });

    this.icon = {
      path:
        'M390 169.3c-20.1 7.3-31.9 16.2-35.5 19.2C342.4 252 310.7 274 286 281a5.4 5.4 0 0 1-6.8-4.1c-.2-.7-.2-.9.2-25.3l-12.3 8.4c-1 .7-2.3 1-3.5 1h-15.4c-1.2 0-2.5-.3-3.5-1l-12.3-8.4c.4 24.4.3 24.6.2 25.3a5.4 5.4 0 0 1-6.8 4.1c-24.6-7.1-56.3-29-68.4-92.5-3.6-3-15.4-11.9-35.6-19.2-21-7.5-55.2-14.6-102.7-8.2a118.3 118.3 0 0 1 41 93.2 101 101 0 0 1 34.8 6.6c18 7 40.5 22.6 50.3 57.3 10.9-8.7 27.8-12.6 53.8-12.6a60.8 60.8 0 0 1 48 22.5 72 72 0 0 1 8.8 13.5c2.3-4.5 5.3-9.2 8.9-13.5a60.8 60.8 0 0 1 48-22.5c26 0 43 4 54 12.7A82.2 82.2 0 0 1 417 261a101 101 0 0 1 34.8-6.6 118.3 118.3 0 0 1 41-93.2c-47.5-6.4-81.8.7-102.7 8.2z',
      strokeWeight: 2,
      labelOrigin: new google.maps.Point(256, 500),
      anchor: new google.maps.Point(256, 330),
      scale: 1,
    };
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): Element {
    return this;
  }
}
