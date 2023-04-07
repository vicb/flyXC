import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { html as baseHtml, TemplateResult } from 'lit/html.js';
import { connect } from 'pwa-helpers';
import { AIRWAYS_TILE_MAX_ZOOM, AIRWAYS_TILE_MIN_ZOOM, AIRWAYS_TILE_URL } from '../../logic/airways';

import { RootState, store } from '../../redux/store';
import { WMTSOverlayElement } from './wmts-overlay';

@customElement('airways-overlay')
export class AirwaysOverlay extends WMTSOverlayElement {
  mapName = 'Thermals';
  copyright = {
    html: baseHtml`thermal.kk7.ch`,
    url: 'https://thermal.kk7.ch',
  };
  zoom = [AIRWAYS_TILE_MIN_ZOOM, AIRWAYS_TILE_MAX_ZOOM];
  bounds = null;
  url = AIRWAYS_TILE_URL;

  getTileUrl(coord: google.maps.Point, zoom: number): string {
    const numTiles = Math.pow(2, zoom);
    return this.url
      .replace('{z}', zoom.toString())
      .replace('{x}', (((coord.x % numTiles) + numTiles) % numTiles).toString())
      .replace('{y}', ((1 << zoom) - coord.y - 1).toString());
  }
}

@customElement('airways-element')
export class AirwaysElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  opacity = 100;
  @state()
  show = false;

  private overlay?: google.maps.ImageMapType;
  private overlayAddedToMap = false;
  private copyrightEl?: HTMLElement;

  stateChanged(state: RootState): void {
    this.show = state.airways.show;
    this.opacity = state.airways.opacity;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeOverlay();
    this.overlay = undefined;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    this.setupOverlay();
    return super.shouldUpdate(changedProperties);
  }

  protected render(): TemplateResult {
    return html`<airways-overlay @overlayready=${this.overlayReady} .map=${this.map}></airways-overlay>`;
  }

  private overlayReady(e: CustomEvent): void {
    this.overlay = e.detail.mapType();
    this.copyrightEl = e.detail.copyrightEl;
    this.setupOverlay();
  }

  private setupOverlay() {
    if (!this.overlay) {
      return;
    }
    if (this.show) {
      this.copyrightEl!.hidden = false;
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
