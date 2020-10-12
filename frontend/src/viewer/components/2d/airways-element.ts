import { css, CSSResult, customElement, html, internalProperty, LitElement, property } from 'lit-element';
import { html as baseHtml, TemplateResult } from 'lit-html';

import { controlStyle } from '../control-style';
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
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private expanded = false;

  private overlay?: google.maps.ImageMapType;

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        input[type='range'] {
          width: 100px;
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
      <input
        type="range"
        min="0.2"
        max="1"
        step="any"
        .hidden=${!this.expanded}
        .value=${String(this.opacity)}
        @input=${this.handleOpacityChange}
      />
      <i class="la la-road la-2x" style="cursor: pointer" @click=${this.toggleExpanded}></i>
      <airways-overlay @overlayready=${this.overlayReady} .map=${this.gMap}></airways-overlay>
    `;
  }

  handleOpacityChange(e: Event): void {
    this.opacity = Number((e.target as HTMLInputElement).value ?? 1);
    this.overlay?.setOpacity(this.opacity);
  }

  private overlayReady(e: CustomEvent): void {
    this.overlay = e.detail.mapType();
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (this.overlay) {
      if (this.expanded) {
        this.gMap.overlayMapTypes.push(this.overlay);
        this.overlay.setOpacity(this.opacity);
      } else {
        for (let i = this.gMap.overlayMapTypes.getLength() - 1; i >= 0; --i) {
          if (this.gMap.overlayMapTypes.getAt(i) == this.overlay) {
            this.gMap.overlayMapTypes.removeAt(i);
            break;
          }
        }
      }
    }
  }
}
