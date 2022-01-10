import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { html as baseHtml, TemplateResult } from 'lit/html.js';
import { connect } from 'pwa-helpers';

import { RootState, store } from '../../redux/store';
import { WMTSOverlayElement } from './wmts-overlay';

@customElement('airways-overlay')
export class AirwaysOverlay extends WMTSOverlayElement {
  mapName = 'Thermals';
  copyright = {
    html: baseHtml`thermal.kk7.ch`,
    url: 'https://thermal.kk7.ch',
  };
  zoom = [0, 15];
  bounds = null;
  url = 'https://thermal.kk7.ch/tiles/skyways_all/{zoom}/{x}/{y}.png?src={domain}'.replace(
    '{domain}',
    window.location.hostname,
  );

  getTileUrl(coord: google.maps.Point, zoom: number): string {
    const numTiles = Math.pow(2, zoom);
    return this.url
      .replace('{zoom}', zoom.toString())
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

  stateChanged(state: RootState): void {
    this.show = state.airways.show;
    this.opacity = state.airways.opacity;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.overlay) {
      if (changedProperties.has('show')) {
        if (this.show) {
          this.map.overlayMapTypes.push(this.overlay);
          this.overlay.setOpacity(this.opacity / 100);
        } else {
          for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; --i) {
            if (this.map.overlayMapTypes.getAt(i) == this.overlay) {
              this.map.overlayMapTypes.removeAt(i);
              break;
            }
          }
        }
        changedProperties.delete('show');
      }

      if (changedProperties.has('opacity')) {
        this.overlay.setOpacity(this.opacity / 100);
        changedProperties.delete('opacity');
      }
    }

    return super.shouldUpdate(changedProperties);
  }

  protected render(): TemplateResult {
    return html`<airways-overlay @overlayready=${this.overlayReady} .map=${this.map}></airways-overlay>`;
  }

  private overlayReady(e: CustomEvent): void {
    this.overlay = e.detail.mapType();
  }
}
