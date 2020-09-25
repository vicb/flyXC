import type Graphic from 'esri/Graphic';
import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import { customElement, internalProperty, LitElement, property } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LatLon, RuntimeTrack } from '../../../../../common/track';
import { Api } from '../../logic/arcgis';
import { sampleAt } from '../../logic/math';
import { trackColor } from '../../logic/tracks';
import * as sel from '../../selectors';
import { RootState, store } from '../../store';

const INACTIVE_HEIGHT = 25;
const ACTIVE_HEIGHT = 50;

@customElement('marker3d-element')
export class Marker3dElement extends connect(store)(LitElement) {
  @property()
  track?: RuntimeTrack;

  @property()
  api?: Api;

  @property()
  layer?: GraphicsLayer;

  @property()
  index = 0;

  @internalProperty()
  private active = false;

  @internalProperty()
  private timestamp = 0;

  @internalProperty()
  private multiplier = 0;

  @internalProperty()
  private tsOffsets: number[] = [];

  @internalProperty()
  displayNames = true;

  private point = {
    type: 'point',
    latitude: 0,
    longitude: 0,
    z: 0,
    hasZ: true,
  };

  private symbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'object',
        height: 50,
        resource: { href: '3d/angry/scene.gltf' },
        material: { color: 'red' },
        anchor: 'relative',
        anchorPosition: { x: 0, y: 0, z: -0.3 },
        heading: 0,
      },
    ],
  };

  private txtSymbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'text',
        material: { color: 'black' },
        halo: { color: 'white', size: 1 },
        size: 12,
        text: '',
      },
    ],
  };

  private graphic?: Graphic;
  private txtGraphic?: Graphic;

  stateChanged(state: RootState): void {
    this.tsOffsets = sel.tsOffsets(state.map);
    this.timestamp = state.map.ts;
    this.active = state.map.currentTrackIndex == this.index;
    this.multiplier = state.map.altMultiplier;
    this.displayNames = state.map.displayNames;
  }

  shouldUpdate(): boolean {
    if (this.api && this.layer && this.track) {
      const fixes = this.track.fixes;
      const timestamp = this.timestamp + this.tsOffsets[this.index];
      const { lat, lon, alt } = sel.getTrackLatLon(store.getState().map)(timestamp, this.index) as LatLon;

      if (!this.graphic) {
        this.graphic = new this.api.Graphic();
        this.txtGraphic = new this.api.Graphic({ symbol: this.txtSymbol as any });
        this.layer.addMany([this.graphic, this.txtGraphic]);
      }

      this.point.latitude = lat;
      this.point.longitude = lon;
      this.point.z = (alt ?? 0) * this.multiplier;
      this.graphic.set('geometry', this.point);

      const objectSymbol = this.symbol.symbolLayers[0];
      objectSymbol.material.color = trackColor(this.index);
      objectSymbol.heading = 180 + sampleAt(fixes.ts, fixes.heading, [timestamp])[0];
      const height = this.active ? ACTIVE_HEIGHT : INACTIVE_HEIGHT;
      objectSymbol.height = height;
      this.graphic.set('symbol', this.symbol);
      this.graphic.set('attributes', { index: this.index });

      this.point.z += height;
      this.txtGraphic?.set('geometry', this.point);

      this.txtSymbol.symbolLayers[0].halo.color = this.active ? trackColor(this.index) : 'white';
      this.txtSymbol.symbolLayers[0].text = this.track?.name ?? 'unknown';
      this.txtGraphic?.set('symbol', this.txtSymbol);
      this.txtGraphic?.set('attributes', { index: this.index });
      this.txtGraphic?.set('visible', this.displayNames);
    }

    return false;
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): Element {
    return this;
  }

  disconnectedCallback(): void {
    if (this.graphic) {
      this.layer?.remove(this.graphic);
    }
    if (this.txtGraphic) {
      this.layer?.remove(this.txtGraphic);
    }
  }
}
