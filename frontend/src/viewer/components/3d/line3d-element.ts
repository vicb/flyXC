import type Graphic from 'esri/Graphic';
import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import { customElement, internalProperty, LitElement, property } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LatLon, RuntimeTrack } from '../../../../../common/track';
import { Api } from '../../logic/arcgis';
import { findIndexes } from '../../logic/math';
import { trackColor } from '../../logic/tracks';
import * as sel from '../../selectors';
import { RootState, store } from '../../store';

const INACTIVE_ALPHA = 0.7;

@customElement('line3d-element')
export class Line3dElement extends connect(store)(LitElement) {
  @property()
  track?: RuntimeTrack;

  @property()
  api?: Api;

  @property()
  layer?: GraphicsLayer;

  @property()
  gndLayer?: GraphicsLayer;

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

  private line = {
    type: 'polyline',
    paths: [[]],
    hasZ: true,
  };

  private symbol = {
    type: 'line-3d',
    symbolLayers: [
      {
        type: 'line',
        size: 2,
        material: { color: [50, 50, 50, 0.6] },
        cap: 'round',
        join: 'round',
      },
    ],
  };

  private graphic?: Graphic;
  private gndGraphic?: Graphic;

  stateChanged(state: RootState): void {
    this.tsOffsets = sel.tsOffsets(state.map);
    this.timestamp = state.map.ts;
    this.active = state.map.currentTrackIndex == this.index;
    this.multiplier = state.map.altMultiplier;
  }

  shouldUpdate(): boolean {
    if (this.api && this.track) {
      if (!this.graphic) {
        this.graphic = new this.api.Graphic();
        this.layer?.add(this.graphic);
        this.gndGraphic = new this.api.Graphic({ symbol: this.symbol as any });
        this.gndLayer?.add(this.gndGraphic);
      }

      const fixes = this.track.fixes;
      const path = [];

      const timestamp = this.timestamp + this.tsOffsets[this.index];
      const start = Math.min(findIndexes(fixes.ts, timestamp - 15 * 60 * 1000)[0], fixes.ts.length - 4);
      const end = Math.max(findIndexes(fixes.ts, timestamp)[0] + 1, 4);

      // TODO: precompute and slice ?
      for (let i = start; i < end; i++) {
        path.push([fixes.lon[i], fixes.lat[i], this.multiplier * fixes.alt[i]]);
      }
      // Make sure the last point matches the marker position.
      const pos = sel.getTrackLatLon(store.getState().map)(timestamp, this.index) as LatLon;
      path.push([pos.lon, pos.lat, this.multiplier * (pos.alt ?? 0)]);
      this.line.paths[0] = path as any;

      this.graphic.set('geometry', this.line);
      this.gndGraphic?.set('geometry', this.line);

      const color = new this.api.Color(trackColor(this.index));
      color.a = this.active ? 1 : INACTIVE_ALPHA;
      const rgba = color.toRgba();
      this.symbol.symbolLayers[0].material.color = rgba;
      this.graphic.set('symbol', this.symbol);
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
    if (this.gndGraphic) {
      this.gndLayer?.remove(this.gndGraphic);
    }
  }
}
