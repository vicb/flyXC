import type Graphic from 'esri/Graphic';
import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import { sampleAt } from 'flyxc/common/src/math';
import { LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import { Api } from '../../logic/arcgis';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

const MARKER_HEIGHT = 30;

@customElement('marker3d-element')
export class Marker3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  track?: RuntimeTrack;

  @internalProperty()
  api?: Api;
  @internalProperty()
  private layer?: GraphicsLayer;
  @internalProperty()
  private active = false;
  @internalProperty()
  private timeSec = 0;
  @internalProperty()
  private multiplier = 0;
  @internalProperty()
  private offsetSeconds = 0;
  @internalProperty()
  private color = '';
  @internalProperty()
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
    this.layer = state.arcgis.graphicsLayer;
    this.api = state.arcgis.api;
    this.timeSec = state.app.timeSec;
    this.multiplier = state.arcgis.altMultiplier;
    this.displayLabels = state.track.displayLabels;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.api == null || this.layer == null) {
      this.destroyMarker();
      return false;
    }

    if (changedProps.has('api') || changedProps.has('track')) {
      this.destroyMarker();
      this.maybeCreateMarker();
    }

    if (this.graphic && this.track) {
      const track = this.track;
      const timeSec = this.timeSec + this.offsetSeconds;
      const { lat, lon, alt } = sel.getTrackLatLonAlt(store.getState())(timeSec, this.track) as LatLonZ;

      this.point.latitude = lat;
      this.point.longitude = lon;
      this.point.z = alt * this.multiplier;
      this.graphic.set('geometry', this.point);

      const objectSymbol = this.symbol.symbolLayers[0];
      objectSymbol.material.color = this.color;
      objectSymbol.heading = 180 + sampleAt(track.timeSec, track.heading, timeSec);
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
    if (this.api && this.layer && this.track) {
      this.graphic = new this.api.Graphic();
      this.txtGraphic = new this.api.Graphic({ symbol: this.txtSymbol as any });
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
  createRenderRoot(): Element {
    return this;
  }
}
