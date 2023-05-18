import { LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import Map from '@arcgis/core/Map';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import TileInfo from '@arcgis/core/layers/support/TileInfo';

import { AIRWAYS_TILE_MAX_ZOOM, AIRWAYS_TILE_MIN_ZOOM, AIRWAYS_TILE_URL } from '../../logic/airways';
import { RootState, store } from '../../redux/store';

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
      tileInfo: TileInfo.create({ numLODs: AIRWAYS_TILE_MAX_ZOOM + 1 }),
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
  fetchTile(zoom: number, y: number, x: number): Promise<HTMLImageElement> {
    let resolveFn: (v: HTMLImageElement) => void;
    let rejectFn: () => void;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const img = document.createElement('img') as HTMLImageElement;
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.setAttribute('crossorigin', 'anonymous');
    img.onload = () => resolveFn(img);
    img.onerror = () => rejectFn();
    img.src = this.getTileUrl(zoom, y, x);

    return promise;
  },
});
