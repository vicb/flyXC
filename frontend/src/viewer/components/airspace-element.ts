import { AspAt, AspMapType, AspZoomMapType } from '../logic/airspaces';
import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';
import { RootState, store } from '../store';
import { UNITS, formatUnit } from '../logic/units';

import { connect } from 'pwa-helpers';

@customElement('airspace-ctrl-element')
export class AirspaceCtrlElement extends connect(store)(LitElement) {
  @property()
  altitude = 1;

  @property()
  restricted = true;

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
    const steps: TemplateResult[] = [];
    if (this.units.altitude == UNITS.feet) {
      for (let ft = 1000; ft <= 17000; ft += 1000) {
        const m = ft / 3.28084;
        steps.push(html` <option value=${m / 1000}>${formatUnit(m, this.units.altitude)}</option> `);
      }
    } else {
      for (let km = 0.5; km <= 6; km += 0.5) {
        steps.push(html` <option value=${km}>${formatUnit(km * 1000, this.units.altitude)}</option> `);
      }
    }
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <div style="float:left;margin-right:5px" .hidden=${!this.expanded}>
        <label
          ><input type="checkbox" ?checked=${this.restricted} @change=${this.handleRestricted} />E, F, G,
          RESTRICTED</label
        >
        <select value=${this.altitude} @change=${this.handleChange}>
          ${steps}
        </select>
      </div>
      <i class="fas fa-fighter-jet fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  protected handleRestricted(e: Event): void {
    if (e.target) {
      const show = (e.target as HTMLInputElement).checked;
      this.dispatchEvent(new CustomEvent('restricted', { detail: { show } }));
    }
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
      const html = AspAt(this.map, latLng, this.altitude, this.restricted);
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
      if ((changedProperties.has('altitude') || changedProperties.has('restricted')) && this.expanded) {
        // Need to remove and re-add the overlays to change the altitude / restricted visibility.
        this.removeOverlays();
        this.addOverlays();
      }
    }
    super.updated(changedProperties);
  }

  protected addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.map?.overlayMapTypes) {
        o.setAltitude(this.altitude);
        o.setShowRestricted(this.restricted);
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
