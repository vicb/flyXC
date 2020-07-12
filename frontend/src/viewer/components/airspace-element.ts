import { AspAt, AspMapType, AspZoomMapType } from '../logic/airspaces';
import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';
import { RootState, store } from '../store';
import { formatUnit } from '../logic/units';
import { aspAltitudeStops, currentAspAltitudeStop } from '../selectors/map';

import { connect } from 'pwa-helpers';
import { MapState } from '../reducers/map';
import { setAspAltitude, setAspShowRestricted } from '../actions/map';

@customElement('airspace-ctrl-element')
export class AirspaceCtrlElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  expanded = false;

  @property()
  get map(): google.maps.Map | null {
    return this.map_;
  }
  set map(map: google.maps.Map | null) {
    this.map_ = map;
    if (map) {
      if (this.overlays.length == 0) {
        this.overlays.push(
          new AspMapType(this.altitudeStop, 13),
          new AspZoomMapType(this.altitudeStop, 13, 14),
          new AspZoomMapType(this.altitudeStop, 13, 15),
          new AspZoomMapType(this.altitudeStop, 13, 16),
          new AspZoomMapType(this.altitudeStop, 13, 17),
        );
        this.info = new google.maps.InfoWindow({});
        this.info.close();
        map.addListener('click', (e: google.maps.MouseEvent): void => this.handleClick(e.latLng));
      }
    }
  }

  @property({ attribute: false })
  units: any = null;

  // Current altitude stop in meters.
  altitudeStop = 1000;

  // Wether to display restricted airspaces.
  aspShowRestricted = true;

  map_: google.maps.Map | null = null;

  overlays: AspMapType[] = [];

  info: google.maps.InfoWindow | null = null;

  mapState: MapState | null = null;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.units = state.map.units;
      this.mapState = state.map;
      const altitudeStop = this.altitudeStop;
      this.altitudeStop = currentAspAltitudeStop(this.mapState);
      const aspShowRestricted = this.aspShowRestricted;
      this.aspShowRestricted = state.map.aspShowRestricted;
      if ((altitudeStop != this.altitudeStop || aspShowRestricted != this.aspShowRestricted) && this.expanded) {
        // Need to remove and re-add the overlays to change the altitude / restricted visibility.
        this.removeOverlays();
        this.addOverlays();
      }
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
    if (!this.mapState) {
      return html``;
    }
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <div style="float:left;margin-right:5px" .hidden=${!this.expanded}>
        <label
          ><input type="checkbox" ?checked=${this.aspShowRestricted} @change=${this.handleRestricted} />E, F, G,
          RESTRICTED</label
        >
        <select value=${this.altitudeStop} @change=${this.handleAltitudeChange}>
          ${aspAltitudeStops(this.mapState).map(
            (stop: number) =>
              html`<option value=${stop} ?selected=${stop == this.altitudeStop}
                >${formatUnit(stop, this.units.altitude)}</option
              > `,
          )}
        </select>
      </div>
      <i class="fas fa-fighter-jet fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  // Show/hide restricted airspaces.
  protected handleRestricted(e: Event): void {
    const show = (e.target as HTMLInputElement).checked;
    store.dispatch(setAspShowRestricted(show));
  }

  // Set the max altitude to display airspaces.
  protected handleAltitudeChange(e: CustomEvent): void {
    const altitude = (e.target as HTMLInputElement).value;
    store.dispatch(setAspAltitude(altitude));
  }

  protected handleClick(latLng: google.maps.LatLng): void {
    if (this.expanded && this.map && this.info && this.mapState) {
      this.info.close();
      const html = AspAt(this.map, latLng, this.altitudeStop, this.aspShowRestricted);
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
    }
    super.updated(changedProperties);
  }

  protected addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.map?.overlayMapTypes) {
        o.setAltitude(this.altitudeStop);
        o.setShowRestricted(this.aspShowRestricted);
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
