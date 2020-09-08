import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { LatLon, RuntimeTrack } from '../../../../../common/track';
import * as act from '../../actions';
import { AspAt, AspMapType, AspZoomMapType, MAX_ASP_TILE_ZOOM } from '../../logic/airspaces';
import { formatUnit } from '../../logic/units';
import * as sel from '../../selectors';
import { RootState, store } from '../../store';
import { controlHostStyle } from '../control-style';

@customElement('airspace-ctrl-element')
export class AirspaceCtrlElement extends connect(store)(LitElement) {
  @property()
  get map(): google.maps.Map | undefined {
    return this.map_;
  }
  set map(map: google.maps.Map | undefined) {
    this.map_ = map;
    if (map) {
      if (this.overlays.length == 0) {
        // Add the overlays for different zoom levels.
        this.overlays = [new AspMapType(this.altitudeStop, MAX_ASP_TILE_ZOOM)];
        for (let zoom = MAX_ASP_TILE_ZOOM + 1; zoom <= 17; zoom++) {
          this.overlays.push(new AspZoomMapType(this.altitudeStop, MAX_ASP_TILE_ZOOM, zoom));
        }
        this.setOverlaysZoom();
        this.info = new google.maps.InfoWindow({ disableAutoPan: true });
        this.info.close();
        map.addListener('click', (e: google.maps.MouseEvent): void => this.handleClick(e.latLng));
        map.addListener('zoom_changed', () => this.setOverlaysZoom());
      }
    }
  }

  private map_: google.maps.Map | undefined;

  @internalProperty()
  private expanded = false;

  @internalProperty()
  private units: any;

  @internalProperty()
  private ts = 0;

  @internalProperty()
  private airspaces: string[] = [];

  // Current altitude stop in meters.
  @internalProperty()
  private altitudeStop = 1000;

  // List of altitude stops.
  @internalProperty()
  private altitudeStops: number[] = [];

  // Whether to display restricted airspaces.
  @internalProperty()
  private aspShowRestricted = true;

  @internalProperty()
  private track?: RuntimeTrack;

  private overlays: AspMapType[] = [];

  private info?: google.maps.InfoWindow;

  stateChanged(state: RootState): void {
    this.units = state.map.units;
    this.altitudeStop = sel.currentAspAltitudeStop(state.map);
    this.altitudeStops = sel.aspAltitudeStops(state.map);
    this.aspShowRestricted = state.map.aspShowRestricted;
    this.track = sel.currentTrack(state.map);
    this.ts = state.map.chart.ts;
    this.airspaces = state.map.chart.airspaces;
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.expanded) {
      // Need to remove and re-add the overlays to change the altitude / restricted visibility.
      if (changedProperties.has('altitudeStop') || changedProperties.has('aspShowRestricted')) {
        this.removeOverlays();
        this.addOverlays();
      }
      if (this.track && (changedProperties.has('ts') || changedProperties.has('airspaces'))) {
        if (this.airspaces.length) {
          const { lat, lon } = sel.getTrackLatLon(store.getState().map)(this.ts) as LatLon;
          this.info?.setContent(this.airspaces.map((t) => `<b>${t}</b>`).join('<br>'));
          this.info?.setPosition({ lat, lng: lon });
          this.info?.open(this.map ?? undefined);
        } else {
          this.info?.close();
        }
        changedProperties.delete('ts');
        changedProperties.delete('airspaces');
      }
    }
    return super.shouldUpdate(changedProperties);
  }

  static get styles(): CSSResult[] {
    return [
      controlHostStyle,
      css`
        select {
          font: inherit;
        }
      `,
    ];
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (!this.expanded) {
      this.info?.close();
    }
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div style="float:left;margin-right:5px" .hidden=${!this.expanded}>
        <label
          ><input type="checkbox" ?checked=${this.aspShowRestricted} @change=${this.handleRestricted} />E, F, G,
          RESTRICTED</label
        >
        <select value=${this.altitudeStop} @change=${this.handleAltitudeChange}>
          ${this.altitudeStops.map(
            (stop: number) =>
              html`<option value=${stop} ?selected=${stop == this.altitudeStop}>
                ${formatUnit(stop, this.units.altitude)}
              </option> `,
          )}
        </select>
      </div>
      <i class="la la-fighter-jet la-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  // Show/hide restricted airspaces.
  private handleRestricted(e: Event): void {
    const show = (e.target as HTMLInputElement).checked;
    store.dispatch(act.setAspShowRestricted(show));
  }

  // Set the max altitude to display airspaces.
  private handleAltitudeChange(e: CustomEvent): void {
    const altitude = (e.target as HTMLInputElement).value;
    store.dispatch(act.setAspAltitude(altitude));
  }

  private handleClick(latLng: google.maps.LatLng): void {
    if (this.expanded && this.map) {
      this.info?.close();
      const html = AspAt(
        this.map.getZoom(),
        { lat: latLng.lat(), lon: latLng.lng() },
        this.altitudeStop,
        this.aspShowRestricted,
      );
      if (html) {
        this.info?.setContent(html);
        this.info?.setPosition(latLng);
        this.info?.open(this.map);
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

  private addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.map?.overlayMapTypes) {
        o.setAltitude(this.altitudeStop);
        o.setShowRestricted(this.aspShowRestricted);
        this.map.overlayMapTypes.push(o);
      }
    });
  }

  private removeOverlays(): void {
    if (this.map) {
      for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
        const o = this.map.overlayMapTypes.getAt(i);
        if (o instanceof AspMapType || o instanceof AspZoomMapType) {
          this.map.overlayMapTypes.removeAt(i);
        }
      }
    }
  }

  // Broadcast the current zoom level to the overlays so that they know when they are active.
  private setOverlaysZoom(): void {
    if (this.map_) {
      const zoom = this.map_.getZoom();
      this.overlays.forEach((overlay) => overlay.setCurrentZoom(zoom));
    }
  }
}
