import { LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
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
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { AspAt, AspMapType, AspZoomMapType, MAX_ASP_TILE_ZOOM } from '../../logic/airspaces';
import * as msg from '../../logic/messages';
import { DistanceUnit, formatUnit } from '../../logic/units';
import { setShowRestrictedAirspace } from '../../redux/airspace-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { controlStyle } from '../../styles/control-style';

@customElement('airspace-ctrl-element')
export class AirspaceCtrlElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private expanded = false;
  @internalProperty()
  private altitudeUnit?: DistanceUnit;
  @internalProperty()
  private airspacesOnGraph: string[] = [];
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
  private subscriptions: UnsubscribeHandle[] = [];
  private zoomListener?: google.maps.MapsEventListener;
  private clickListener?: google.maps.MapsEventListener;
  private timestamp = 0;

  connectedCallback(): void {
    super.connectedCallback();
    // Add the overlays for different zoom levels.
    this.overlays = [new AspMapType(this.altitudeStop, MAX_ASP_TILE_ZOOM)];
    for (let zoom = MAX_ASP_TILE_ZOOM + 1; zoom <= 17; zoom++) {
      this.overlays.push(new AspZoomMapType(this.altitudeStop, MAX_ASP_TILE_ZOOM, zoom));
    }
    this.setOverlaysZoom();
    this.info = new google.maps.InfoWindow({ disableAutoPan: true });
    this.info.close();
    this.subscriptions.push(
      msg.trackGroupsAdded.subscribe(() => this.updateAltitudeStop()),
      msg.trackGroupsRemoved.subscribe(() => this.updateAltitudeStop()),
    );
    this.updateAltitudeStop();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overlays.length = 0;
    this.info = undefined;
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
  }

  stateChanged(state: RootState): void {
    this.altitudeUnit = state.units.altitude;
    this.altitudeStops = sel.airspaceAltitudeStops(state);
    this.aspShowRestricted = state.airspace.showRestricted;
    this.track = sel.currentTrack(state);
    this.timestamp = state.app.timestamp;
    this.airspacesOnGraph = state.airspace.onGraph;
  }

  shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.expanded) {
      // Need to remove and re-add the overlays to change the altitude / restricted visibility.
      if (changedProperties.has('altitudeStop') || changedProperties.has('aspShowRestricted')) {
        this.removeOverlays();
        this.addOverlays();
      }
      // The airspacesOnGraph property gets updated from the graph each time the cursor moves.
      if (this.track && changedProperties.has('airspacesOnGraph')) {
        if (this.airspacesOnGraph.length) {
          const { lat, lon } = sel.getTrackLatLonAlt(store.getState())(this.timestamp) as LatLonZ;
          this.info?.setContent(this.airspacesOnGraph.map((t) => `<b>${t}</b>`).join('<br>'));
          this.info?.setPosition({ lat, lng: lon });
          this.info?.open(this.gMap);
        } else {
          this.info?.close();
        }
        changedProperties.delete('airspaces');
      }
    }
    if (changedProperties.has('expanded')) {
      if (this.expanded) {
        this.addOverlays();
        this.clickListener = this.gMap.addListener('click', (e): void => this.handleMapClick(e.latLng));
        this.zoomListener = this.gMap.addListener('zoom_changed', () => this.setOverlaysZoom());
      } else {
        this.removeOverlays();
        this.info?.close();
        this.clickListener?.remove();
        this.zoomListener?.remove();
      }
      changedProperties.delete('expanded');
    }
    return super.shouldUpdate(changedProperties);
  }

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        select {
          font: inherit;
        }
      `,
    ];
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div style="float:left;margin-right:5px" .hidden=${!this.expanded}>
        <label
          ><input type="checkbox" ?checked=${this.aspShowRestricted} @change=${this.toggleRestricted} />E, F, G,
          RESTRICTED</label
        >
        <select value=${this.altitudeStop} @change=${this.handleAltitudeChange}>
          ${this.altitudeStops.map(
            (stop: number) =>
              html`<option value=${stop} ?selected=${stop == this.altitudeStop}>
                ${formatUnit(stop, this.altitudeUnit)}
              </option> `,
          )}
        </select>
      </div>
      <i class="la la-fighter-jet la-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
    `;
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  // Show/hide restricted airspaces.
  private toggleRestricted(e: Event): void {
    const show = (e.target as HTMLInputElement).checked;
    store.dispatch(setShowRestrictedAirspace(show));
  }

  // Set the max altitude to display airspaces.
  private handleAltitudeChange(e: CustomEvent): void {
    this.altitudeStop = Number((e.target as HTMLInputElement).value);
  }

  private handleMapClick(latLng: google.maps.LatLng): void {
    if (this.expanded) {
      this.info?.close();
      const html = AspAt(
        this.gMap.getZoom(),
        { lat: latLng.lat(), lon: latLng.lng() },
        this.altitudeStop,
        this.aspShowRestricted,
      );
      if (html) {
        this.info?.setContent(html);
        this.info?.setPosition(latLng);
        this.info?.open(this.gMap);
      }
    }
  }

  private addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.gMap.overlayMapTypes) {
        o.setAltitude(this.altitudeStop);
        o.setShowRestricted(this.aspShowRestricted);
        this.gMap.overlayMapTypes.push(o);
      }
    });
  }

  private removeOverlays(): void {
    for (let i = this.gMap.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      const o = this.gMap.overlayMapTypes.getAt(i);
      if (o instanceof AspMapType || o instanceof AspZoomMapType) {
        this.gMap.overlayMapTypes.removeAt(i);
      }
    }
  }

  // Updates the altitude select with the max altitude across tracks.
  // Triggered on init and when tracks get added or removed.
  private updateAltitudeStop(): void {
    const stops = this.altitudeStops;
    if (stops.length > 0) {
      const maxAlt = sel.maxAlt(store.getState());
      this.altitudeStop = stops.find((alt) => alt >= maxAlt) ?? stops[stops.length - 1];
    }
  }

  // Broadcast the current zoom level to the overlays so that they know when they are active.
  private setOverlaysZoom(): void {
    const zoom = this.gMap.getZoom();
    this.overlays.forEach((overlay) => overlay.setCurrentZoom(zoom));
  }
}
