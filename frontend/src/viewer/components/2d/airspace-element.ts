import { LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { AspAt, AspMapType, AspZoomMapType, MAX_ASP_TILE_ZOOM } from '../../logic/airspaces';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

@customElement('airspace-element')
export class AirspaceElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private show = false;
  @state()
  private airspacesOnGraph: string[] = [];
  @state()
  private maxAltitude = 1000;
  // Whether to display restricted airspaces.
  @state()
  private showRestricted = true;
  @state()
  private track?: RuntimeTrack;

  private overlays: AspMapType[] = [];
  private info?: google.maps.InfoWindow;
  private zoomListener?: google.maps.MapsEventListener;
  private clickListener?: google.maps.MapsEventListener;
  private timeSec = 0;

  connectedCallback(): void {
    super.connectedCallback();
    // Add the overlays for different zoom levels.
    this.overlays = [new AspMapType(this.maxAltitude, MAX_ASP_TILE_ZOOM)];
    for (let zoom = MAX_ASP_TILE_ZOOM + 1; zoom <= 17; zoom++) {
      this.overlays.push(new AspZoomMapType(this.maxAltitude, MAX_ASP_TILE_ZOOM, zoom));
    }
    this.setOverlaysZoom();
    this.info = new google.maps.InfoWindow({ disableAutoPan: true });
    this.info.close();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overlays.length = 0;
    this.info = undefined;
  }

  stateChanged(state: RootState): void {
    this.show = state.airspace.show;
    this.showRestricted = state.airspace.showRestricted;
    this.maxAltitude = state.airspace.maxAltitude;
    this.track = sel.currentTrack(state);
    this.timeSec = state.app.timeSec;
    this.airspacesOnGraph = state.airspace.onGraph;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.show) {
      // Need to remove and re-add the overlays to change the altitude / restricted visibility.
      if (changedProperties.has('maxAltitude') || changedProperties.has('showRestricted')) {
        this.removeOverlays();
        this.addOverlays();
      }
      // The airspacesOnGraph property gets updated from the graph each time the cursor moves.
      if (this.track && changedProperties.has('airspacesOnGraph')) {
        if (this.airspacesOnGraph.length) {
          const { lat, lon } = sel.getTrackLatLonAlt(store.getState())(this.timeSec) as LatLonZ;
          this.info?.setContent(this.airspacesOnGraph.map((t) => `<b>${t}</b>`).join('<br>'));
          this.info?.setPosition({ lat, lng: lon });
          this.info?.open(this.map);
        } else {
          this.info?.close();
        }
      }
    }
    if (changedProperties.has('show')) {
      if (this.show) {
        this.addOverlays();
        this.clickListener = this.map?.addListener('click', (e): void => this.handleMapClick(e.latLng));
        this.zoomListener = this.map?.addListener('zoom_changed', () => this.setOverlaysZoom());
      } else {
        this.removeOverlays();
        this.info?.close();
        this.clickListener?.remove();
        this.zoomListener?.remove();
      }
    }
    // Nothing to render.
    return false;
  }

  private handleMapClick(latLng: google.maps.LatLng): void {
    if (this.show) {
      this.info?.close();
      const html = AspAt(
        this.map?.getZoom() ?? 10,
        { lat: latLng.lat(), lon: latLng.lng() },
        this.maxAltitude,
        this.showRestricted,
      );
      if (html) {
        this.info?.setContent(html);
        this.info?.setPosition(latLng);
        this.info?.open(this.map);
      }
    }
  }

  private addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.map?.overlayMapTypes) {
        o.setAltitude(this.maxAltitude);
        o.setShowRestricted(this.showRestricted);
        this.map.overlayMapTypes.push(o);
      }
    });
  }

  private removeOverlays(): void {
    if (!this.map) {
      return;
    }
    for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      const o = this.map.overlayMapTypes.getAt(i);
      if (o instanceof AspMapType || o instanceof AspZoomMapType) {
        this.map.overlayMapTypes.removeAt(i);
      }
    }
  }

  // Broadcast the current zoom level to the overlays so that they know when they are active.
  private setOverlaysZoom(): void {
    const zoom = this.map?.getZoom() ?? 10;
    this.overlays.forEach((overlay) => overlay.setCurrentZoom(zoom));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}
