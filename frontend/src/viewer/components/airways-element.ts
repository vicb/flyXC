import { css, CSSResult, customElement, html, LitElement, property } from 'lit-element';
import { html as baseHtml, TemplateResult } from 'lit-html';

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
  url = 'https://thermal.kk7.ch/php/tile.php?typ=skyways&t=all&z={zoom}&x={x}&y={y}&src={domain}'.replace(
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

@customElement('airways-ctrl-element')
export class AirwaysCtrlElement extends LitElement {
  @property()
  opacity = 0.5;

  @property()
  expanded = false;

  @property()
  map: google.maps.Map | null = null;

  overlay: google.maps.ImageMapType | null = null;

  handleChange(e: Event): void {
    if (e.target && this.overlay) {
      this.opacity = Number((e.target as HTMLInputElement).value);
      this.overlay.setOpacity(this.opacity);
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
        input[type='range'] {
          width: 100px;
        }
      `,
    ];
  }

  protected toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (this.overlay && this.map) {
      if (this.expanded) {
        this.map.overlayMapTypes.push(this.overlay);
        this.overlay.setOpacity(this.opacity);
      } else {
        for (let i = this.map.overlayMapTypes.getLength() - 1; i >= 0; --i) {
          if (this.map.overlayMapTypes.getAt(i) == this.overlay) {
            this.map.overlayMapTypes.removeAt(i);
            break;
          }
        }
      }
    }
  }

  protected overlayReady(e: CustomEvent): void {
    this.overlay = e.detail.mapType();
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <input
        type="range"
        min="0.2"
        max="1"
        step="any"
        .hidden=${!this.expanded}
        .value=${String(this.opacity)}
        @input=${this.handleChange}
      />
      <i class="fas fa-road fa-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
      <airways-overlay @overlayready=${this.overlayReady} .map=${this.map}></airways-overlay>
    `;
  }
}
