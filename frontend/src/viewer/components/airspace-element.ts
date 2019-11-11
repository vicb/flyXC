import { AspAt, AspMapType, AspZoomMapType } from '../logic/airspaces';
import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';
import { RootState, store } from '../store';

import { connect } from 'pwa-helpers';
import { formatUnit } from '../logic/units';

@customElement('airspace-ctrl-element')
export class AirspaceCtrlElement extends connect(store)(LitElement) {
  @property()
  altitude = 1;

  @property()
  expanded = false;

  map_: google.maps.Map | null = null;

  @property()
  get map(): google.maps.Map | null {
    return this.map_;
  }
  set map(map: google.maps.Map | null) {
    this.map_ = map;
    if (map) {
      if (this.overlays.length == 0) {
        this.overlays.push(
          new AspMapType(this.altitude, 13),
          new AspZoomMapType(this.altitude, 13, 14),
          new AspZoomMapType(this.altitude, 13, 15),
          new AspZoomMapType(this.altitude, 13, 16),
          new AspZoomMapType(this.altitude, 13, 17),
        );
        this.info = new google.maps.InfoWindow({});
        this.info.close();
        map.addListener('click', (e: google.maps.MouseEvent): void => this.handleClick(e.latLng));
      }
    }
  }

  @property({ attribute: false })
  units: any = null;

  overlays: AspMapType[] = [];

  info: google.maps.InfoWindow | null = null;

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
        select {
          font: inherit;
        }
      `,
    ];
  }

  protected toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (!this.expanded && this.info) {
      this.info.close();
    }
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <select value=${this.altitude} @change=${this.handleChange} .hidden=${!this.expanded}>
        <option value="1">${formatUnit(1000, this.units.altitude)}</option>
        <option value="2">${formatUnit(2000, this.units.altitude)}</option>
        <option value="3">${formatUnit(3000, this.units.altitude)}</option>
        <option value="4">${formatUnit(4000, this.units.altitude)}</option>
        <option value="5">${formatUnit(5000, this.units.altitude)}</option>
        <option value="6">${formatUnit(6000, this.units.altitude)}</option>
      </select>
      <i class="fas fa-fighter-jet fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  protected handleChange(e: Event): void {
    if (e.target) {
      const altitude = (e.target as HTMLSelectElement).value;
      this.dispatchEvent(new CustomEvent('change', { detail: { altitude } }));
    }
  }

  protected handleClick(latLng: google.maps.LatLng): void {
    if (this.expanded && this.map && this.info) {
      this.info.close();
      const html = AspAt(this.map, latLng, this.altitude);
      if (html) {
        this.info.setContent(html);
        this.info.setPosition(latLng);
        this.info.open(this.map);
      }
    }
  }

  updated(changedProperties: PropertyValues): void {
    if (this.map) {
      if (changedProperties.has('expanded')) {
        if (this.expanded) {
          this.addOverlays();
        } else {
          this.removeOverlays();
        }
      }
      if (changedProperties.has('altitude') && this.expanded) {
        // Need to remove and re-add the overlays to change the altitude
        this.removeOverlays();
        this.addOverlays();
      }
    }
    super.updated(changedProperties);
  }

  protected addOverlays(): void {
    this.overlays.forEach(o => {
      if (this.map?.overlayMapTypes) {
        o.setAltitude(this.altitude);
        this.map.overlayMapTypes.push(o);
      }
    });
  }

  protected removeOverlays(): void {
    if (this.map) {
      for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
        const o = this.map.overlayMapTypes.getAt(i);
        if (o instanceof AspMapType || o instanceof AspZoomMapType) {
          this.map.overlayMapTypes.removeAt(i);
        }
      }
    }
  }
}
