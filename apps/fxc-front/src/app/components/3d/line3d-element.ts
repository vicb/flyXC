import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import * as common from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import * as sel from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';

const INACTIVE_ALPHA = 0.7;

@customElement('line3d-element')
export class Line3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  track?: common.RuntimeTrack;
  @property({ attribute: false })
  layer?: GraphicsLayer;
  @property({ attribute: false })
  gndLayer?: GraphicsLayer;

  @state()
  private opacity = 1;
  @state()
  private timeSec = 0;
  @state()
  private multiplier = 0;
  @state()
  private offsetSeconds = 0;
  @state()
  private color = '';

  private line = {
    type: 'polyline',
    paths: [] as number[][][],
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
  private path3d: number[][] = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyLines();
  }

  stateChanged(state: RootState): void {
    if (this.track) {
      const id = this.track.id;
      this.offsetSeconds = sel.offsetSeconds(state)[id];
      this.color = sel.trackColors(state)[id];
      this.opacity = id == sel.currentTrackId(state) ? 1 : INACTIVE_ALPHA;
    }
    this.timeSec = state.app.timeSec;
    this.multiplier = state.arcgis.altMultiplier;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.layer == null || this.gndLayer == null) {
      this.destroyLines();
      return false;
    }

    if (changedProps.has('track') || changedProps.has('multiplier')) {
      this.destroyLines();
      this.maybeCreateLines();
    }

    if (this.graphic && this.track) {
      const timeSecs = this.track.timeSec;

      const timeSec = this.timeSec + this.offsetSeconds;

      const start = Math.min(common.findIndexes(timeSecs, timeSec - 15 * 60).beforeIndex, timeSecs.length - 4);
      const end = Math.max(common.findIndexes(timeSecs, timeSec).beforeIndex + 1, 4);
      const path = this.path3d.slice(start, end);
      // The last point must match the marker position and needs to be interpolated.
      const pos = sel.getTrackLatLonAlt(store.getState())(timeSec, this.track) as common.LatLonAlt;
      path.push([pos.lon, pos.lat, this.multiplier * pos.alt]);
      this.line.paths[0] = path;

      this.graphic.set('geometry', this.line);
      this.graphic.set('attributes', { trackId: this.track.id });
      this.gndGraphic?.set('geometry', this.line);
      this.gndGraphic?.set('attributes', { trackId: this.track.id });

      const color = new Color(this.color);
      color.a = this.opacity;
      const rgba = color.toRgba();
      this.symbol.symbolLayers[0].material.color = rgba;
      this.graphic.set('symbol', this.symbol);
    }

    return false;
  }

  private maybeCreateLines(): void {
    if (this.layer && this.gndLayer && this.track) {
      this.graphic = new Graphic();
      this.layer.add(this.graphic);
      this.symbol.symbolLayers[0].material.color = [50, 50, 50, 0.6];
      this.gndGraphic = new Graphic({ symbol: this.symbol as any });
      this.gndLayer.add(this.gndGraphic);
      this.path3d.length = 0;
      const track = this.track;
      this.track.lat.forEach((lat, i) => this.path3d.push([track.lon[i], lat, this.multiplier * track.alt[i]]));
    }
  }

  private destroyLines(): void {
    if (this.graphic) {
      this.layer?.remove(this.graphic);
    }
    this.graphic = undefined;
    if (this.gndGraphic) {
      this.gndLayer?.remove(this.gndGraphic);
    }
    this.gndGraphic = undefined;
    this.path3d.length = 0;
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): HTMLElement {
    return this;
  }
}
