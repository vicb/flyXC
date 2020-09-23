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

  graphic?: Graphic;

  stateChanged(state: RootState): void {
    this.tsOffsets = sel.tsOffsets(state.map);
    this.timestamp = state.map.ts;
    this.active = state.map.currentTrackIndex == this.index;
    this.multiplier = state.map.altMultiplier;
  }

  shouldUpdate(): boolean {
    if (this.api && this.layer && this.track) {
      const fixes = this.track.fixes;
      const timestamp = this.timestamp + this.tsOffsets[this.index];
      const { lat, lon, alt } = sel.getTrackLatLon(store.getState().map)(timestamp, this.index) as LatLon;

      this.point.latitude = lat;
      this.point.longitude = lon;
      this.point.z = (alt ?? 0) * this.multiplier;

      const objectSymbol = this.symbol.symbolLayers[0];
      objectSymbol.material.color = trackColor(this.index);
      objectSymbol.heading = 180 + sampleAt(fixes.ts, fixes.heading, [timestamp])[0];
      objectSymbol.height = this.active ? ACTIVE_HEIGHT : INACTIVE_HEIGHT;

      if (!this.graphic) {
        this.graphic = new this.api.Graphic({});
        this.layer.add(this.graphic);
      }

      this.graphic.geometry = this.point as any;
      this.graphic.symbol = this.symbol as any;
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
  }
}
