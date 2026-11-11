import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import LineSymbol3D from '@arcgis/core/symbols/LineSymbol3D';
import LineSymbol3DLayer from '@arcgis/core/symbols/LineSymbol3DLayer';
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

const INACTIVE_ALPHA = 0.7;
const MARKER_HEIGHT = 30;

/**
 * Renders and synchronously updates a track's 3D polyline, ground shadow, pilot model, and label.
 */
@customElement('track3d-element')
export class Track3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  track?: common.RuntimeTrack;
  @property({ attribute: false })
  layer?: GraphicsLayer;
  @property({ attribute: false })
  gndLayer?: GraphicsLayer;

  @state()
  private active = false;
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
  @state()
  private displayLabels = true;

  private line = {
    type: 'polyline',
    paths: [] as number[][][],
    hasZ: true,
  };

  private point = {
    type: 'point',
    latitude: 0,
    longitude: 0,
    z: 0,
    hasZ: true,
  };

  private lineLayer?: LineSymbol3DLayer;
  private objectLayer?: ObjectSymbol3DLayer;
  private textLayer?: TextSymbol3DLayer;
  private lineGraphic?: Graphic;
  private gndGraphic?: Graphic;
  private markerGraphic?: Graphic;
  private txtGraphic?: Graphic;
  private path3d: number[][] = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyGraphics();
  }

  /**
   * Synchronizes track offset, color, active state, opacity, timestamp, multiplier, and label visibility from Redux state.
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
      this.opacity = this.active ? 1 : INACTIVE_ALPHA;
    }
    this.timeSec = app.selectTimeSec(state);
    this.multiplier = arcgis.selectAltitudeMultiplier(state);
    this.displayLabels = track.selectDisplayLabels(state);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.layer == null || this.gndLayer == null) {
      this.destroyGraphics();
      return false;
    }

    if (
      changedProps.has('track') ||
      changedProps.has('multiplier') ||
      changedProps.has('layer') ||
      changedProps.has('gndLayer')
    ) {
      this.destroyGraphics();
      this.createGraphics();
    }

    if (this.lineGraphic && this.markerGraphic && this.track) {
      const currentTrack = this.track;
      const timeSecs = currentTrack.timeSec;
      const timeSec = this.timeSec + this.offsetSeconds;
      const pos = selectTrackLatLonAlt(store.getState())(timeSec, currentTrack) as common.LatLonAlt;
      const z = this.multiplier * pos.alt;

      const start = Math.min(common.findIndexes(timeSecs, timeSec - 15 * 60).beforeIndex, timeSecs.length - 4);
      const end = Math.max(common.findIndexes(timeSecs, timeSec).beforeIndex + 1, 4);
      const path = this.path3d.slice(start, end);
      // The last point must match the marker position and needs to be interpolated.
      path.push([pos.lon, pos.lat, z]);
      this.line.paths[0] = path;
      this.lineGraphic.set('geometry', this.line);
      this.gndGraphic?.set('geometry', this.line);

      this.point.latitude = pos.lat;
      this.point.longitude = pos.lon;
      this.point.z = z;
      this.markerGraphic.set('geometry', this.point);

      this.point.z = z + MARKER_HEIGHT;
      this.txtGraphic?.set('geometry', this.point);

      if (this.objectLayer) {
        const heading = 180 + common.sampleAt(timeSecs, currentTrack.heading, timeSec);
        if (this.objectLayer.heading !== heading) {
          this.objectLayer.heading = heading;
        }
      }

      const styleChanged =
        changedProps.has('track') ||
        changedProps.has('multiplier') ||
        changedProps.has('layer') ||
        changedProps.has('gndLayer') ||
        changedProps.has('color');
      if (this.lineLayer && (styleChanged || changedProps.has('opacity'))) {
        this.lineLayer.material = { color: this.getLineRgba() };
      }
      const color = this.color || 'red';
      if (this.objectLayer && styleChanged) {
        this.objectLayer.material = { color };
      }
      if (this.textLayer && (styleChanged || changedProps.has('active'))) {
        this.textLayer.halo = { color: this.active ? color : 'white', size: 1 };
      }
      if (
        this.txtGraphic &&
        (changedProps.has('track') ||
          changedProps.has('multiplier') ||
          changedProps.has('layer') ||
          changedProps.has('displayLabels'))
      ) {
        const label = currentTrack.name ?? 'unknown';
        this.txtGraphic.visible = this.displayLabels && label != 'unknown';
      }
    }

    return false;
  }

  private getLineRgba(): number[] {
    const color = new Color(this.color || 'red');
    color.a = this.opacity;
    return color.toRgba();
  }

  private createGraphics(): void {
    if (this.layer == null || this.gndLayer == null || this.track == null) {
      return;
    }

    const currentTrack = this.track;
    const color = this.color || 'red';
    const label = currentTrack.name ?? 'unknown';
    const attributes = { trackId: currentTrack.id };

    this.path3d.length = 0;
    currentTrack.lat.forEach((lat, i) =>
      this.path3d.push([currentTrack.lon[i], lat, this.multiplier * currentTrack.alt[i]]),
    );

    this.lineLayer = new LineSymbol3DLayer({
      size: 2,
      material: { color: this.getLineRgba() },
      cap: 'round',
      join: 'round',
    });

    this.lineGraphic = new Graphic({
      symbol: new LineSymbol3D({ symbolLayers: [this.lineLayer] }),
      attributes,
    });

    this.gndGraphic = new Graphic({
      symbol: new LineSymbol3D({
        symbolLayers: [
          new LineSymbol3DLayer({
            size: 2,
            material: { color: [50, 50, 50, 0.6] },
            cap: 'round',
            join: 'round',
          }),
        ],
      }),
      attributes,
    });

    this.objectLayer = new ObjectSymbol3DLayer({
      height: MARKER_HEIGHT,
      resource: { href: '/static/models/angry.glb' },
      material: { color },
      anchor: 'relative',
      anchorPosition: { x: 0, y: 0, z: -0.3 },
      heading: 0,
    });

    this.markerGraphic = new Graphic({
      symbol: new PointSymbol3D({ symbolLayers: [this.objectLayer] }),
      attributes,
    });

    this.textLayer = new TextSymbol3DLayer({
      material: { color: 'black' },
      halo: { color: this.active ? color : 'white', size: 1 },
      size: 12,
      text: label,
    });

    this.txtGraphic = new Graphic({
      symbol: new PointSymbol3D({ symbolLayers: [this.textLayer] }),
      attributes,
      visible: this.displayLabels && label != 'unknown',
    });

    this.layer.addMany([this.lineGraphic, this.markerGraphic, this.txtGraphic]);
    this.gndLayer.add(this.gndGraphic);
  }

  private destroyGraphics(): void {
    const graphicsToRemove = [this.lineGraphic, this.markerGraphic, this.txtGraphic].filter(
      (g): g is Graphic => g != null,
    );
    if (graphicsToRemove.length > 0) {
      this.layer?.removeMany(graphicsToRemove);
    }
    if (this.gndGraphic) {
      this.gndLayer?.remove(this.gndGraphic);
    }

    this.lineLayer = undefined;
    this.objectLayer = undefined;
    this.textLayer = undefined;
    this.lineGraphic = undefined;
    this.gndGraphic = undefined;
    this.markerGraphic = undefined;
    this.txtGraphic = undefined;
    this.path3d.length = 0;
  }

  // There is no content - no need to create a shadow root.
  createRenderRoot(): HTMLElement {
    return this;
  }
}
