import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import type Map from '@arcgis/core/Map';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import TileInfo from '@arcgis/core/layers/support/TileInfo';

import * as skyways from '../../redux/skyways-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';

@customElement('skyways3d-element')
export class Skyways3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: Map;

  @state()
  opacity = 0.5;
  @state()
  show = false;
  @state()
  maxZoom = 13;
  @state()
  tileUrl = skyways.getTileUrl(store.getState());

  private layer?: WebTileLayer;

  stateChanged(state: RootState): void {
    this.show = state.skyways.show;
    this.opacity = state.skyways.opacity;
    this.tileUrl = skyways.getTileUrl(state);
    this.maxZoom = skyways.getTileMaxZoom(state.skyways.layer);
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

      if (changedProperties.has('tileUrl') || changedProperties.has('maxZoom')) {
        this.removeLayer();
        this.setupLayer();
        changedProperties.delete('titleUrl');
        changedProperties.delete('maxZoom');
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
    const layer = new SkywaysLayer({
      urlTemplate: this.tileUrl,
      copyright: 'Skyways &copy; <a href="https://thermal.kk7.ch/">kk7.ch</a>',
      title: 'thermals',
      tileInfo: TileInfo.create({ numLODs: this.maxZoom + 1 }),
    });

    layer.visible = this.show;
    this.map.add(layer);
    this.layer = layer;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

const SkywaysLayer = (WebTileLayer as any).createSubclass({
  getTileUrl(zoom: number, y: number, x: number) {
    return this.urlTemplate
      .replace('{z}', String(zoom))
      .replace('{x}', String(x))
      .replace('{y}', String((1 << zoom) - y - 1));
  },
  fetchTile(zoom: number, y: number, x: number, options: { signal?: AbortSignal }): Promise<HTMLImageElement> {
    let resolveFn: (v: HTMLImageElement) => void;
    let rejectFn: () => void;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const img = document.createElement('img') as HTMLImageElement;
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.setAttribute('crossorigin', 'anonymous');
    img.onload = () => {
      if (options.signal && options.signal.aborted) {
        return;
      }
      resolveFn(img);
    };
    img.onerror = () => rejectFn();
    img.src = this.getTileUrl(zoom, y, x);

    return promise;
  },
});
