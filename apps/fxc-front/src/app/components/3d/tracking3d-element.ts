import Color from '@arcgis/core/Color';
import Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import type { LiveLineProperties, LivePointProperties } from '../../logic/live-track';
import { FixType } from '../../logic/live-track';
import { popupContent } from '../../logic/live-track-popup';
import * as msg from '../../logic/messages';
import type { Units } from '../../logic/units';
import { formatDurationMin } from '../../logic/units';
import * as arcgis from '../../redux/arcgis-slice';
import * as liveTrack from '../../redux/live-track-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectTrackTotal } from '../../redux/track-slice';
import * as unitsSlice from '../../redux/units-slice';
import { getUniqueContrastColor } from '../../styles/track';
import { createPopupContent } from './popup-content';

// A track is considered recent if ended less than timeout ago.
const RECENT_TIMEOUT_MIN = 2 * 60;
const MSG_MARKER_HEIGHT = 30;
/** Debounce delay before re-sampling elevations after terrain tiles update. */
const SAMPLER_REFRESH_DEBOUNCE_MS = 150;

@customElement('tracking3d-element')
export class Tracking3DElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  layer?: GraphicsLayer;
  @property({ attribute: false })
  gndLayer?: GraphicsLayer;
  @property({ attribute: false })
  sampler?: ElevationSampler;

  @state()
  private geojson: any;
  @state()
  private multiplier = 1;
  @state()
  private displayLabels = true;
  // Id of the selected pilot.
  @state()
  private currentId?: string;
  @state()
  private numTracks = 0;

  // live tracks.
  private tracks: Graphic[] = [];
  // live track shadows.
  private trackShadows: Graphic[] = [];
  // messages, pilots and texts.
  private markers: Graphic[] = [];
  private subscriptions: UnsubscribeHandle[] = [];
  /** Subscription handle for terrain elevation updates from {@link sampler}. */
  private samplerHandle?: { remove: () => void };
  /** Pending debounce timer ID for {@link sampler} refresh updates. */
  private samplerTimer?: number;
  private units?: Units;

  private line = {
    type: 'polyline',
    paths: [] as number[][][],
    hasZ: true,
  };

  private trackSymbol = {
    type: 'line-3d',
    symbolLayers: [
      {
        type: 'line',
        size: 1,
        material: { color: [50, 50, 50, 0.6] },
        cap: 'round',
        join: 'round',
        pattern: {
          type: 'style',
          style: 'dash',
        },
      },
    ],
  };

  private msgSymbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'object',
        width: MSG_MARKER_HEIGHT,
        resource: { href: '/static/models/msg.glb' },
        material: { color: [50, 50, 50, 0.6] },
        anchor: 'relative',
        anchorPosition: { x: 0.1, y: -0.45, z: 0 },
        tilt: 90,
      },
    ],
  };

  private santaSymbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'object',
        width: MSG_MARKER_HEIGHT,
        resource: { href: '/static/models/santa.glb' },
        material: { color: [50, 50, 50, 0.6] },
        anchor: 'relative',
        tilt: 0,
        heading: 0,
      },
    ],
  };

  private ufoSymbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'object',
        width: MSG_MARKER_HEIGHT,
        resource: { href: '/static/models/ufo.glb' },
        anchor: 'relative',
        tilt: 0,
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
    this.samplerHandle?.remove();
    this.samplerHandle = undefined;
    clearTimeout(this.samplerTimer);
    this.samplerTimer = undefined;
    if (this.layer) {
      this.layer.removeMany(this.tracks);
      this.layer.removeMany(this.markers);
      this.tracks.length = 0;
      this.markers.length = 0;
    }
    if (this.gndLayer) {
      this.gndLayer.removeMany(this.trackShadows);
      this.trackShadows.length = 0;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.subscriptions.push(msg.clickSceneView.subscribe((graphic, scene) => this.handleClick(graphic, scene)));
  }

  stateChanged(state: RootState): void {
    this.displayLabels = liveTrack.selectDisplayLabels(state);
    this.geojson = liveTrack.selectGeojson(state);
    this.multiplier = arcgis.selectAltitudeMultiplier(state);
    this.units = unitsSlice.selectUnits(state);
    this.currentId = liveTrack.selectCurrentLiveId(state);
    this.numTracks = selectTrackTotal(state);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('sampler')) {
      this.samplerHandle?.remove();
      this.samplerHandle = this.sampler?.on('changed', () => {
        clearTimeout(this.samplerTimer);
        this.samplerTimer = window.setTimeout(() => this.updateMarkers(), SAMPLER_REFRESH_DEBOUNCE_MS);
      });
    }

    if (
      changedProps.has('layer') ||
      changedProps.has('gndLayer') ||
      changedProps.has('geojson') ||
      changedProps.has('multiplier') ||
      changedProps.has('currentId') ||
      changedProps.has('numTracks')
    ) {
      this.updateTracks();
    }

    if (
      changedProps.has('layer') ||
      changedProps.has('sampler') ||
      changedProps.has('geojson') ||
      changedProps.has('multiplier') ||
      changedProps.has('currentId') ||
      changedProps.has('displayLabels')
    ) {
      this.updateMarkers();
    }

    return false;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  /**
   * Computes the elevation for a marker point by clamping scaled GPS altitude to terrain height.
   *
   * @param point - Geographic location used to query terrain elevation.
   * @param rawAlt - Unscaled track altitude in meters.
   * @returns Clamped `z` coordinate in meters.
   */
  private clampElevation(point: Point, rawAlt: number): number {
    const scaledAlt = rawAlt * this.multiplier;
    const sampled = this.sampler?.queryElevation(point) as Point | null | undefined;
    const z = sampled?.z;
    // The sampler sometimes returns sentinel/noData values (e.g. NaN, 3.40e+37 or noDataValue).
    if (typeof z !== 'number' || !Number.isFinite(z) || z === this.sampler?.noDataValue || z > 20000) {
      return scaledAlt;
    }
    return Math.max(z, scaledAlt);
  }

  // Updates the live tracks from the geojson.
  private updateTracks() {
    if (!this.layer || !this.gndLayer) {
      return;
    }

    const nowSec = Date.now() / 1000;
    const tracks: Graphic[] = [];
    const trackShadows: Graphic[] = [];

    for (const feature of this.geojson.features) {
      if (feature.geometry.type != 'LineString') {
        continue;
      }
      const lineProperties = feature.properties as LiveLineProperties;
      const id = lineProperties.id;
      const isEmergency = lineProperties.isEmergency;
      const ageMin = (nowSec - lineProperties.lastTimeSec) / 60;
      // Recent tracks should be more visible unless there are non-live tracks.
      const hasRecentStyle = ageMin < RECENT_TIMEOUT_MIN && this.numTracks == 0;
      const hasSelectedStyle = id === this.currentId;

      const graphic = new Graphic();
      const shadowGraphic = new Graphic();
      const path = feature.geometry.coordinates.map(([lon, lat, z]: number[]) => [lon, lat, z * this.multiplier]);

      this.line.paths[0] = path;
      graphic.set('geometry', this.line);
      shadowGraphic.set('geometry', this.line);

      const color = new Color(lineProperties.isUfo ? '#aaa' : getUniqueContrastColor(id));
      color.a = isEmergency || hasRecentStyle || hasSelectedStyle ? 1 : 0.8;
      const rgba = color.toRgba();
      this.trackSymbol.symbolLayers[0].material.color = rgba;
      this.trackSymbol.symbolLayers[0].size = isEmergency ? 5 : hasSelectedStyle ? 3 : hasRecentStyle ? 2 : 1;
      this.trackSymbol.symbolLayers[0].pattern.style = lineProperties.last ? 'solid' : 'dash';
      graphic.set('symbol', this.trackSymbol);
      graphic.set('attributes', { liveTrackId: id });
      tracks.push(graphic);
      this.trackSymbol.symbolLayers[0].material.color = [50, 50, 50, hasSelectedStyle || hasRecentStyle ? 0.6 : 0.2];
      shadowGraphic.set('symbol', this.trackSymbol);
      trackShadows.push(shadowGraphic);
    }

    this.layer.addMany(tracks);
    this.layer.removeMany(this.tracks);
    this.tracks = tracks;
    this.gndLayer.addMany(trackShadows);
    this.gndLayer.removeMany(this.trackShadows);
    this.trackShadows = trackShadows;
  }

  /**
   * Updates live marker and label graphics, clamping markers above terrain via {@link sampler}.
   */
  private updateMarkers(): void {
    if (!this.layer) {
      return;
    }

    const nowSec = Date.now() / 1000;
    const markers: Graphic[] = [];

    for (const feature of this.geojson.features) {
      if (feature.geometry.type != 'Point') {
        continue;
      }

      const pointProperties = feature.properties as LivePointProperties;
      const pilotId = pointProperties.pilotId;
      const fixType = pointProperties.fixType;
      // heading is set for the last point only (i.e. the pilot position).
      const ageMin = Math.round((nowSec - pointProperties.timeSec) / 60);
      const isRecentTrack = ageMin < RECENT_TIMEOUT_MIN;
      const isActive = pilotId === this.currentId;

      let symbol: any;
      let label: string | undefined;

      switch (fixType) {
        case FixType.emergency:
          this.msgSymbol.symbolLayers[0].material.color = [255, 0, 0, 1.0];
          symbol = this.msgSymbol;
          break;
        case FixType.message:
          this.msgSymbol.symbolLayers[0].material.color = [255, 255, 0, isActive || isRecentTrack ? 1 : 0.7];
          symbol = this.msgSymbol;
          break;
        case FixType.pilot:
          {
            const heading = pointProperties.heading ?? 0;
            if (pointProperties.isUfo) {
              this.ufoSymbol.symbolLayers[0].heading = heading + 180;
              symbol = this.ufoSymbol;
            } else {
              const color = new Color(getUniqueContrastColor(pilotId));
              color.a = isActive || isRecentTrack ? 1 : 0.7;
              const rgba = color.toRgba();
              this.santaSymbol.symbolLayers[0].material.color = rgba;
              this.santaSymbol.symbolLayers[0].heading = heading + 180;
              symbol = this.santaSymbol;
            }
            // Text.
            if (this.displayLabels && (isActive || ageMin < 12 * 60)) {
              label = pointProperties.name + ' -' + formatDurationMin(ageMin);
            }
          }
          break;
        default:
          continue;
      }

      const graphic = new Graphic();
      graphic.set('symbol', symbol);
      const [lon, lat, rawAlt] = feature.geometry.coordinates as [number, number, number];
      const point = new Point({
        latitude: lat,
        longitude: lon,
        z: 0,
        hasZ: true,
      });
      point.z = this.clampElevation(point, rawAlt);
      graphic.set('geometry', point);
      graphic.set('attributes', { liveTrackId: pilotId, liveTrackIndex: pointProperties.index });
      markers.push(graphic);

      if (label) {
        const labelGraphic = new Graphic();
        const labelPoint = point.clone();
        labelPoint.z! += MSG_MARKER_HEIGHT;
        labelGraphic.set('geometry', labelPoint);
        this.txtSymbol.symbolLayers[0].text = label;
        this.txtSymbol.symbolLayers[0].material.color = isActive ? '#BF1515' : 'black';
        labelGraphic.set('symbol', this.txtSymbol);
        labelGraphic.set('attributes', { liveTrackId: pilotId, liveTrackIndex: pointProperties.index, isLabel: true });
        markers.push(labelGraphic);
      }
    }

    this.layer.addMany(markers);
    this.layer.removeMany(this.markers);
    this.markers = markers;
  }

  /**
   * Opens the popup anchored to the clicked marker's clamped geometry.
   *
   * @param graphic - Clicked graphic from the scene hit test.
   * @param scene - Scene element displaying the popup.
   */
  private handleClick(graphic: Graphic, scene: ArcgisScene) {
    const attr = graphic.attributes;
    if (attr?.liveTrackId != null) {
      store.dispatch(liveTrack.setCurrentLiveId(attr.liveTrackId));
      if (attr.liveTrackIndex != null && this.units && graphic.geometry?.type === 'point') {
        const popup = popupContent(attr.liveTrackId, attr.liveTrackIndex, this.units);
        if (!popup) {
          return;
        }

        const location = (graphic.geometry as Point).clone();
        if (!attr.isLabel && location.z != null) {
          location.z += MSG_MARKER_HEIGHT;
        }

        void scene.openPopup({
          location,
          title: popup.title,
          content: createPopupContent(popup.content),
        });
      }
    }
  }
}
