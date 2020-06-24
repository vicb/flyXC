import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { linearInterpolate } from '../logic/math';
import { formatUnit } from '../logic/units';
import { Units } from '../reducers/map';
import { RootState, store } from '../store';

@customElement('tracking-element')
export class TrackingElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  get map(): google.maps.Map | null {
    return this.map_;
  }
  set map(map: google.maps.Map | null) {
    this.map_ = map;
    if (map && this.fetchId == null) {
      this.fetchTrackers();
      this.fetchId = setInterval(() => this.fetchTrackers(), 2 * 60 * 1000);
      this.setMapStyle(map);
      this.setupListener(map);
    }
  }
  map_: google.maps.Map | null = null;

  units: Units | null = null;

  info: google.maps.InfoWindow | null = null;

  features: any[] = [];

  private fetchId: any = null;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.units = state.map.units;
    }
  }

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 5px;
          background-color: #adff2f;
          text-align: right;
          border-radius: 4px;
          opacity: 0.9;
          user-select: none;
          float: right;
          clear: both;
        }
      `,
    ];
  }

  protected fetchTrackers(): void {
    fetch('_trackers.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((geoJson) => {
        if (geoJson != null) {
          const map = this.map as google.maps.Map;
          const features = this.features;
          this.features = map.data.addGeoJson(geoJson);
          features.forEach((f) => map.data.remove(f));
        }
      });
  }

  protected setupListener(map: google.maps.Map): void {
    const hasPointFeature = (event: any): boolean => event.feature?.getGeometry().getType() == 'Point';
    this.info = new google.maps.InfoWindow();
    this.info.close();

    map.data.addListener('click', (event: any) => {
      if (hasPointFeature(event)) {
        const f = event.feature as any;
        const latLng: google.maps.LatLng = f.getGeometry().get();
        const date = new Date(f.getProperty('ts'));
        const content: string[] = [
          `<strong>${f.getProperty('name')}</strong>`,
          `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
          `${formatUnit(f.getProperty('alt'), this.units?.altitude || 'm')} ${
            f.getProperty('speed') != null ? formatUnit(f.getProperty('speed'), this.units?.speed || 'km/h') : ''
          }`,
          `<a href=${`https://www.google.com/maps/dir//${latLng.lat()},${latLng.lng()}`} target="_blank">Directions</a>`,
        ];
        if (f.getProperty('msg')) {
          content.push(f.getProperty('msg'));
        }
        if (f.getProperty('emergency')) {
          content.push('<strong>Emergency</strong>');
        }

        this.info?.setContent(content.join('<br/>'));
        this.info?.setPosition(event.latLng);
        this.info?.open(map);
      }
    });
  }

  protected setMapStyle(map: google.maps.Map): void {
    map.data.setStyle(
      (feature: google.maps.Data.Feature): google.maps.Data.StyleOptions => {
        const now = Date.now();
        // Point features have a 'ts' property.
        // Line feature has a 'first_ts' property.
        const ts = feature.getProperty('ts') || feature.getProperty('first_ts');
        const old = now - 5 * 3600 * 1000;
        const s = linearInterpolate(old, 10, now, 100, ts);
        let color = `hsl(111, ${s}%, 53%)`;
        let zIndex = 10;
        const age_hours = (now - ts) / (3600 * 1000);
        let opacity = age_hours > 12 ? 0.3 : 0.9;
        if (feature.getProperty('msg')) {
          opacity = 1;
          color = 'yellow';
          zIndex += 10;
        }
        if (feature.getProperty('emergency')) {
          opacity = 1;
          color = 'red';
          zIndex += 10;
        }
        return {
          strokeColor: '#555',
          strokeWeight: 2,
          strokeOpacity: opacity,
          fillOpacity: opacity,
          zIndex,
          cursor: 'zoom-in',
          icon: {
            path: 'M 0,10 A 10,10 0 0 0 20,10 A 10,10 0 0 0 0,10',
            fillColor: color,
            fillOpacity: opacity,
            strokeColor: 'black',
            strokeWeight: 1,
            strokeOpacity: opacity,
            anchor: new google.maps.Point(10, 10),
            scale: 0.6,
          },
        };
      },
    );
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <i
        class="fas fa-satellite-dish fa-2x"
        style="cursor: pointer"
        @click=${(): void => void (document.location.href = '/tracking.html')}
      ></i>
    `;
  }
}
