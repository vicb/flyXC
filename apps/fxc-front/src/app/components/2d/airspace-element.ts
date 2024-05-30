import * as common from '@flyxc/common';
import { LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { AspMapType, AspZoomMapType, getAirspaceList } from '../../logic/airspaces';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

@customElement('airspace-element')
export class AirspaceElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private show = false;
  @state()
  private maxAltitude = 1000;
  @state()
  private showClasses: common.Class[] = [];
  @state()
  private showTypes: common.Type[] = [];
  @state()
  private track?: common.RuntimeTrack;
  @state()
  private timeSec = 0;

  private overlays: AspMapType[] = [];
  private info?: google.maps.InfoWindow;
  private zoomListener?: google.maps.MapsEventListener;
  private clickListener?: google.maps.MapsEventListener;

  // We want to display the airspaces at the click location.
  // However clicking the map also results in a timeSec update (for the closest fix).
  // isMapClick is used as a flag to discriminate the source of the timeSec update.
  private isMapClick = false;

  connectedCallback(): void {
    super.connectedCallback();
    // Add the overlays for different zoom levels.
    this.overlays = [new AspMapType(this.maxAltitude, common.MAX_AIRSPACE_TILE_ZOOM)];
    for (let zoom = common.MAX_AIRSPACE_TILE_ZOOM + 1; zoom <= 17; zoom++) {
      this.overlays.push(new AspZoomMapType(this.maxAltitude, common.MAX_AIRSPACE_TILE_ZOOM, zoom));
    }
    this.setOverlaysZoom();
    this.info = new google.maps.InfoWindow({ disableAutoPan: true, headerDisabled: false, headerContent: 'Airspaces' });
    this.info.close();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overlays.length = 0;
    this.info = undefined;
  }

  stateChanged(state: RootState): void {
    this.show = state.airspace.show;
    this.showClasses = state.airspace.showClasses;
    this.showTypes = state.airspace.showTypes;
    this.maxAltitude = state.airspace.maxAltitude;
    this.track = sel.currentTrack(state);
    this.timeSec = state.app.timeSec;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.show) {
      // Need to remove and re-add the overlays to change the altitude / restricted visibility.
      if (
        changedProperties.has('maxAltitude') ||
        changedProperties.has('showClasses') ||
        changedProperties.has('showTypes')
      ) {
        this.removeOverlays();
        this.addOverlays();
      }
      if (this.track && changedProperties.has('timeSec') && !this.isMapClick) {
        const point = sel.getTrackLatLonAlt(store.getState())(this.timeSec) as common.LatLonAlt;
        const gndAlt = sel.getGndAlt(store.getState())(this.timeSec);
        this.showAirspaceInfo(point, gndAlt);
      }
    }
    if (changedProperties.has('show')) {
      if (this.show) {
        this.addOverlays();
        this.clickListener = this.map.addListener('click', async (e: any) => this.handleMapClick(e.latLng));
        this.zoomListener = this.map.addListener('zoom_changed', () => this.setOverlaysZoom());
      } else {
        this.removeOverlays();
        this.info?.close();
        this.clickListener?.remove();
        this.zoomListener?.remove();
      }
    }
    this.isMapClick = false;
    // Nothing to render.
    return false;
  }

  private async handleMapClick(latLng: google.maps.LatLng): Promise<void> {
    this.isMapClick = true;
    this.showAirspaceInfo({ lat: latLng.lat(), lon: latLng.lng(), alt: this.maxAltitude });
  }

  private async showAirspaceInfo(point: common.LatLonAlt, gndAlt = 0) {
    if (this.show) {
      const html = await getAirspaceList(
        Math.round(this.map.getZoom() ?? 10),
        point,
        point.alt,
        gndAlt,
        this.showClasses,
        this.showTypes,
      );
      if (html !== '') {
        this.info?.setContent(html);
        this.info?.setPosition({ lat: point.lat, lng: point.lon });
        this.info?.open(this.map);
      } else {
        this.info?.close();
      }
    }
  }

  private addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.map.overlayMapTypes) {
        o.setAltitude(this.maxAltitude);
        o.showClasses(this.showClasses);
        o.showTypes(this.showTypes);
        this.map.overlayMapTypes.push(o as any);
      }
    });
  }

  private removeOverlays(): void {
    for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      const o = this.map.overlayMapTypes.getAt(i);
      if (o instanceof AspMapType || o instanceof AspZoomMapType) {
        this.map.overlayMapTypes.removeAt(i);
      }
    }
  }

  // Broadcast the current zoom level to the overlays so that they know when they are active.
  private setOverlaysZoom(): void {
    const zoom = Math.round(this.map.getZoom() ?? 10);
    this.overlays.forEach((overlay) => overlay.setCurrentZoom(zoom));
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }
}
