import { LitElement, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Map from '@arcgis/core/Map';

import { RootState, store } from '../../redux/store';
import { AIRWAYS_TILE_MAX_ZOOM, AIRWAYS_TILE_MIN_ZOOM, AIRWAYS_TILE_URL } from '../../logic/airways';

@customElement('airways3d-element')
export class Airways3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: Map;

  @state()
  opacity = 0.5;
  @state()
  show = false;

  private layer?: WebTileLayer;

  stateChanged(state: RootState): void {
    this.show = state.airways.show;
    this.opacity = state.airways.opacity;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.layer) {
      if (changedProperties.has('show')) {
        changedProperties.delete('show');
        this.layer.visible = this.show;
      }

      if (changedProperties.has('opacity')) {
        changedProperties.delete('opacity');
        this.layer.opacity = this.opacity / 100;
      }
    }

    return super.shouldUpdate(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeLayer();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupLayer();
  }

  private removeLayer() {
    if (this.layer) {
      this.map.remove(this.layer);
      this.layer.destroy();
      this.layer == undefined;
    }
  }

  private setupLayer() {
    this.layer = new AirwaysLayer({
      urlTemplate: AIRWAYS_TILE_URL,
      maxScale: AIRWAYS_TILE_MAX_ZOOM,
      minScale: AIRWAYS_TILE_MIN_ZOOM,
      copyright: 'Skyways &copy; <a href="https://thermal.kk7.ch/">kk7.ch</a>',
      title: 'thermals',
    });
    this.map.add(this.layer!);
  }

  createRenderRoot(): Element {
    return this;
  }
}

const AirwaysLayer = (WebTileLayer as any).createSubclass({
  getTileUrl(zoom: number, y: number, x: number) {
    return this.urlTemplate
      .replace('{z}', String(zoom))
      .replace('{x}', String(x))
      .replace('{y}', String((1 << zoom) - y - 1));
  },
});
