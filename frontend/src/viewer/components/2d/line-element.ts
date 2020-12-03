import { RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

const INACTIVE_OPACITY = 0.5;

@customElement('line-element')
export class LineElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @property({ attribute: false })
  track?: RuntimeTrack;

  @internalProperty()
  private color = '';
  @internalProperty()
  private opacity = 1;

  private line?: google.maps.Polyline;
  private maskLine?: google.maps.Polyline;
  private lineOption?: google.maps.PolylineOptions;

  stateChanged(state: RootState): void {
    if (this.track) {
      this.color = sel.trackColors(state)[this.track.id] ?? '';
      this.opacity = sel.currentTrackId(state) == this.track.id ? 1 : INACTIVE_OPACITY;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyLines();
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.map == null || this.track == null) {
      this.destroyLines();
    }
    if (changedProps.has('map') || changedProps.has('track')) {
      this.destroyLines();
      this.maybeCreateLines();
    }
    if (this.lineOption && (changedProps.has('opacity') || changedProps.has('color'))) {
      this.lineOption.strokeColor = this.color;
      this.lineOption.strokeOpacity = this.opacity;
      this.line?.setOptions(this.lineOption);
    }

    return false;
  }

  // Creates the lines when there is a track.
  private maybeCreateLines() {
    if (this.track == null) {
      return;
    }

    const track = this.track;
    const path = track.lat.map((lat, i) => ({
      lat,
      lng: track.lon[i],
    }));

    this.maskLine = new google.maps.Polyline({
      path,
      clickable: false,
      map: this.gMap,
      strokeColor: '#fff',
      strokeOpacity: 0.6,
      strokeWeight: 6,
    });

    this.lineOption = {
      path,
      clickable: false,
      map: this.gMap,
      strokeWeight: 2,
      strokeOpacity: this.opacity,
      strokeColor: this.color,
    };

    this.line = new google.maps.Polyline(this.lineOption);
  }

  private destroyLines() {
    this.lineOption = undefined;
    this.line?.setMap(null);
    this.line = undefined;
    this.maskLine?.setMap(null);
    this.maskLine = undefined;
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): Element {
    return this;
  }
}
