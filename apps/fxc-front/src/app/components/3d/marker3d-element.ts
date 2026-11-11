import Graphic from '@arcgis/core/Graphic';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer';
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D';
import TextSymbol3DLayer from '@arcgis/core/symbols/TextSymbol3DLayer';
import * as common from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import * as app from '../../redux/app-slice';
import * as arcgis from '../../redux/arcgis-slice';
import { selectTrackLatLonAlt } from '../../redux/selectors/position';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import * as track from '../../redux/track-slice';

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
  private displayLabels = true;

  private point = {
    type: 'point',
    latitude: 0,
    longitude: 0,
    z: 0,
    hasZ: true,
  };

  private objectLayer?: ObjectSymbol3DLayer;
  private textLayer?: TextSymbol3DLayer;
  private graphic?: Graphic;
  private txtGraphic?: Graphic;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyMarker();
  }

  /**
   * Synchronizes track offset, color, active state, timestamp, multiplier, and label visibility from Redux state.
   *
   * @param state - The current root state of the Redux store.
   */
  stateChanged(state: RootState): void {
    if (this.track) {
      const id = this.track.id;
      // Fall back to 0 if the track has no offset (e.g. single day or not yet computed).
      this.offsetSeconds = track.selectOffsetSeconds(state)[id] ?? 0;
      this.color = track.selectTrackColors(state)[id];
      this.active = id == track.selectCurrentTrackId(state);
    }
    this.timeSec = app.selectTimeSec(state);
    this.multiplier = arcgis.selectAltitudeMultiplier(state);
    this.displayLabels = track.selectDisplayLabels(state);
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
      const { lat, lon, alt } = selectTrackLatLonAlt(store.getState())(timeSec, this.track) as common.LatLonAlt;

      this.point.latitude = lat;
      this.point.longitude = lon;
      this.point.z = alt * this.multiplier;
      this.graphic.set('geometry', this.point);

      const color = this.color || 'red';
      if (this.objectLayer) {
        if (changedProps.has('track') || changedProps.has('color')) {
          this.objectLayer.material = { color };
        }
        const heading = 180 + common.sampleAt(track.timeSec, track.heading, timeSec);
        if (this.objectLayer.heading !== heading) {
          this.objectLayer.heading = heading;
        }
      }

      this.point.z += MARKER_HEIGHT;
      this.txtGraphic?.set('geometry', this.point);

      if (this.textLayer && (changedProps.has('track') || changedProps.has('active') || changedProps.has('color'))) {
        this.textLayer.halo = { color: this.active ? color : 'white', size: 1 };
      }
      if (this.txtGraphic && (changedProps.has('track') || changedProps.has('displayLabels'))) {
        const label = track.name ?? 'unknown';
        this.txtGraphic.visible = this.displayLabels && label != 'unknown';
      }
    }

    return false;
  }

  private maybeCreateMarker(): void {
    if (this.layer && this.track) {
      const color = this.color || 'red';
      const label = this.track.name ?? 'unknown';

      this.objectLayer = new ObjectSymbol3DLayer({
        height: MARKER_HEIGHT,
        resource: { href: '/static/models/angry.glb' },
        material: { color },
        anchor: 'relative',
        anchorPosition: { x: 0, y: 0, z: -0.3 },
        heading: 0,
      });

      this.graphic = new Graphic({
        symbol: new PointSymbol3D({ symbolLayers: [this.objectLayer] }),
        attributes: { trackId: this.track.id },
      });

      this.textLayer = new TextSymbol3DLayer({
        material: { color: 'black' },
        halo: { color: this.active ? color : 'white', size: 1 },
        size: 12,
        text: label,
      });

      this.txtGraphic = new Graphic({
        symbol: new PointSymbol3D({ symbolLayers: [this.textLayer] }),
        attributes: { trackId: this.track.id },
        visible: this.displayLabels && label != 'unknown',
      });

      this.layer.addMany([this.graphic, this.txtGraphic]);
    }
  }

  private destroyMarker(): void {
    if (this.graphic) {
      this.layer?.remove(this.graphic);
    }
    this.graphic = undefined;
    this.objectLayer = undefined;
    if (this.txtGraphic) {
      this.layer?.remove(this.txtGraphic);
    }
    this.txtGraphic = undefined;
    this.textLayer = undefined;
  }

  // There is not content - no need to create a shadow root.
  createRenderRoot(): HTMLElement {
    return this;
  }
}
