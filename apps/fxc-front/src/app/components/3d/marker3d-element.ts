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

const MARKER_HEIGHT = 30;

@customElement('marker3d-element')
export class Marker3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  track?: common.RuntimeTrack;
  @property({ attribute: false })
  layer?: GraphicsLayer;

  @state()
  private active = false;
  @state()
  private timeSec = 0;
  @state()
  private multiplier = 0;
  @state()
  private offsetSeconds = 0;
  @state()
  private color = '';
  @state()
  displayLabels = true;

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
        height: MARKER_HEIGHT,
        resource: { href: '/static/models/angry.glb' },
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyMarker();
  }

  stateChanged(state: RootState): void {
    if (this.track) {
      const id = this.track.id;
      this.offsetSeconds = sel.offsetSeconds(state)[id];
      this.color = sel.trackColors(state)[id];
      this.active = id == sel.currentTrackId(state);
    }
    this.timeSec = state.app.timeSec;
    this.multiplier = state.arcgis.altMultiplier;
    this.displayLabels = state.track.displayLabels;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.layer == null) {
      this.destroyMarker();
      return false;
    }

    if (changedProps.has('track')) {
      this.destroyMarker();
      this.maybeCreateMarker();
    }

    if (this.graphic && this.track) {
      const track = this.track;
      const timeSec = this.timeSec + this.offsetSeconds;
      const { lat, lon, alt } = sel.getTrackLatLonAlt(store.getState())(timeSec, this.track) as common.LatLonAlt;

      this.point.latitude = lat;
      this.point.longitude = lon;
      this.point.z = alt * this.multiplier;
      this.graphic.set('geometry', this.point);

      const objectSymbol = this.symbol.symbolLayers[0];
      objectSymbol.material.color = this.color;
      objectSymbol.heading = 180 + common.sampleAt(track.timeSec, track.heading, timeSec);
      this.graphic.set('symbol', this.symbol);
      this.graphic.set('attributes', { trackId: this.track?.id });

      this.point.z += MARKER_HEIGHT;
      this.txtGraphic?.set('geometry', this.point);

      this.txtSymbol.symbolLayers[0].halo.color = this.active ? this.color : 'white';
      const label = track.name ?? 'unknown';
      this.txtSymbol.symbolLayers[0].text = label;
      this.txtGraphic?.set('symbol', this.txtSymbol);
      this.txtGraphic?.set('attributes', { trackId: track.id });
      this.txtGraphic?.set('visible', this.displayLabels && label != 'unknown');
    }

    return false;
  }

  private maybeCreateMarker(): void {
    if (this.layer && this.track) {
      this.graphic = new Graphic();
      this.txtGraphic = new Graphic({ symbol: this.txtSymbol as any });
      this.layer.addMany([this.graphic, this.txtGraphic]);
    }
  }

  private destroyMarker(): void {
    if (this.graphic) {
      this.layer?.remove(this.graphic);
    }
    this.graphic = undefined;
    if (this.txtGraphic) {
      this.layer?.remove(this.txtGraphic);
    }
    this.txtGraphic = undefined;
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): HTMLElement {
    return this;
  }
}
