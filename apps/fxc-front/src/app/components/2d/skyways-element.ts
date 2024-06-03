import type { PropertyValues } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TemplateResult } from 'lit/html.js';
import { connect } from 'pwa-helpers';
import * as skyways from '../../redux/skyways-slice';
import type { RootState} from '../../redux/store';
import { store } from '../../redux/store';
import { GMAP_MAX_ZOOM_LEVEL } from './map-element';
import { WMTSInterpolatingOverlayElement } from './wmts-overlay';

@customElement('skyways-overlay')
export class SkywaysOverlay extends WMTSInterpolatingOverlayElement {
  mapName = 'Thermals';
  copyright = {
    html: `thermal.kk7.ch`,
    url: 'https://thermal.kk7.ch',
  };
  zoom = [skyways.TILE_MIN_ZOOM, GMAP_MAX_ZOOM_LEVEL];
  bounds = null;
  @property()
  url = '';
  @property({ type: Number })
  maxTileZoom = 12;

  getTileUrl(coord: google.maps.Point, zoom: number): string {
    const numTiles = Math.pow(2, zoom);
    return this.url
      .replace('{z}', zoom.toString())
      .replace('{x}', (((coord.x % numTiles) + numTiles) % numTiles).toString())
      .replace('{y}', ((1 << zoom) - coord.y - 1).toString());
  }
}

@customElement('skyways-element')
export class SkywaysElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  opacity = 100;
  @state()
  show = false;
  @state()
  tileUrl = '';

  private overlay?: google.maps.ImageMapType;
  private overlayAddedToMap = false;
  private copyrightEl?: HTMLElement;

  stateChanged(state: RootState): void {
    this.show = state.skyways.show;
    this.opacity = state.skyways.opacity;
    this.tileUrl = skyways.getTileUrl(state);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeOverlay();
    this.overlay = undefined;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    this.setupOverlay(changedProperties.has('tileUrl'));
    return super.shouldUpdate(changedProperties);
  }

  protected render(): TemplateResult {
    return html`<skyways-overlay
      url=${this.tileUrl}
      @overlayready=${this.overlayReady}
      .map=${this.map}
    ></skyways-overlay>`;
  }

  private overlayReady(e: CustomEvent): void {
    this.overlay = e.detail.mapType();
    this.copyrightEl = e.detail.copyrightEl;
    this.setupOverlay(false);
  }

  // `force` will force remove an existing overlay.
  // Used to refresh the tiles when the url changes.
  private setupOverlay(force: boolean) {
    if (!this.overlay) {
      return;
    }
    if (this.show) {
      this.copyrightEl!.hidden = false;
      if (force) {
        this.removeOverlay();
      }
      if (!this.overlayAddedToMap) {
        this.map.overlayMapTypes.push(this.overlay!);
        this.overlayAddedToMap = true;
      }
      this.overlay?.setOpacity(this.opacity / 100);
    } else {
      this.copyrightEl!.hidden = true;

      this.removeOverlay();
    }
  }

  private removeOverlay() {
    if (this.map && this.overlay) {
      for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; --i) {
        if (this.map.overlayMapTypes.getAt(i) == this.overlay) {
          this.map.overlayMapTypes.removeAt(i);
          break;
        }
      }
      this.overlayAddedToMap = false;
    }
  }
}
