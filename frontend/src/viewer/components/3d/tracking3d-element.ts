import { LiveTrack } from 'flyxc/common/protos/live-track';
import { getFixMessage, isEmergencyFix } from 'flyxc/common/src/live-track';
import { customElement, internalProperty, LitElement, PropertyValues } from 'lit-element';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { Api } from '../../logic/arcgis';
import { popupContent } from '../../logic/live-track-popup';
import * as msg from '../../logic/messages';
import { formatDurationMin, Units } from '../../logic/units';
import { liveTrackSelectors, setCurrentLiveId } from '../../redux/live-track-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { getUniqueColor } from '../../styles/track';

import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import type Graphic from 'esri/Graphic';
import type SceneView from 'esri/views/SceneView';
import type ElevationSampler from 'esri/layers/support/ElevationSampler';
import type Point from 'esri/geometry/Point';

// A track is considered recent if ended less than timeout ago.
const RECENT_TIMEOUT_MIN = 2 * 60;
const MSG_MARKER_HEIGHT = 30;

@customElement('tracking3d-element')
export class Tracking3DElement extends connect(store)(LitElement) {
  @internalProperty()
  private geojson: any;
  @internalProperty()
  private layer?: GraphicsLayer;
  @internalProperty()
  private gndLayer?: GraphicsLayer;
  @internalProperty()
  private api?: Api;
  @internalProperty()
  private multiplier = 1;
  @internalProperty()
  private displayLabels = true;
  @internalProperty()
  private sampler?: ElevationSampler;
  // Id of the selected pilot.
  @internalProperty()
  private currentId?: number;
  @internalProperty()
  private numTracks = 0;

  // live tracks.
  private tracks: Graphic[] = [];
  // live track shadows.
  private trackShadows: Graphic[] = [];
  // messages, pilots and texts.
  private markers: Graphic[] = [];
  private subscriptions: UnsubscribeHandle[] = [];
  private units?: Units;
  private popupConfigured = false;

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
      },
    ],
  };

  private msgSymbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'object',
        width: MSG_MARKER_HEIGHT,
        resource: { href: '3d/msg/scene.gltf' },
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
        resource: { href: '3d/santa.glb' },
        material: { color: [50, 50, 50, 0.6] },
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
    this.subscriptions.push(msg.clickSceneView.subscribe((graphic, view) => this.handleClick(graphic, view)));
    this.popupConfigured = false;
  }

  stateChanged(state: RootState): void {
    this.displayLabels = state.liveTrack.displayLabels;
    this.geojson = state.liveTrack.geojson;
    this.layer = state.arcgis.graphicsLayer;
    this.gndLayer = state.arcgis.gndGraphicsLayer;
    this.api = state.arcgis.api;
    this.multiplier = state.arcgis.altMultiplier;
    this.units = state.units;
    this.sampler = state.arcgis.elevationSampler;
    this.currentId = state.liveTrack.currentLiveId;
    this.numTracks = sel.numTracks(state);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (this.layer && this.api && this.gndLayer) {
      this.updateTracks();
      this.updateMarkers();
    }
    return super.shouldUpdate(changedProps);
  }

  // Updates the live tracks from the geojson.
  private updateTracks() {
    if (!this.api || !this.layer || !this.gndLayer) {
      return;
    }

    const nowSec = Date.now() / 1000;
    const tracks: Graphic[] = [];
    const trackShadows: Graphic[] = [];

    for (const feature of this.geojson.features) {
      if (feature.geometry.type != 'LineString' || feature.properties.last !== true) {
        continue;
      }
      const id = feature.properties.id;
      const endIdx = feature.properties.endIndex;
      const track = liveTrackSelectors.selectById(store.getState(), id) as LiveTrack;
      const ageMin = (nowSec - track.timeSec[endIdx]) / 60;
      // Recent tracks should be more visible unless there are non-live tracks.
      const hasRecentStyle = ageMin < RECENT_TIMEOUT_MIN && this.numTracks == 0;
      const hasSelectedStyle = id === this.currentId;

      const graphic = new this.api.Graphic();
      const shadowGraphic = new this.api.Graphic();
      const path = feature.geometry.coordinates.map(([lon, lat, z]: number[]) => [lon, lat, z * this.multiplier]);

      this.line.paths[0] = path;
      graphic.set('geometry', this.line);
      shadowGraphic.set('geometry', this.line);

      const color = new this.api.Color(getUniqueColor(Math.round(id / 1000)));
      color.a = hasRecentStyle || hasSelectedStyle ? 1 : 0.8;
      const rgba = color.toRgba();
      this.trackSymbol.symbolLayers[0].material.color = rgba;
      this.trackSymbol.symbolLayers[0].size = hasSelectedStyle ? 3 : hasRecentStyle ? 2 : 1;
      graphic.set('symbol', this.trackSymbol);
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

  // Updates markers from the geojson.
  private updateMarkers() {
    if (!this.api || !this.layer || !this.gndLayer) {
      return;
    }

    const nowSec = Date.now() / 1000;
    const markers: Graphic[] = [];

    for (const feature of this.geojson.features) {
      if (feature.geometry.type != 'Point') {
        continue;
      }

      const id = feature.properties.id;
      const track = liveTrackSelectors.selectById(store.getState(), id) as LiveTrack;
      const index = feature.properties.index;
      const message = getFixMessage(track, index);
      const isEmergency = isEmergencyFix(track.flags[index]);
      // heading is set for the last point only (i.e. the pilot position).
      const heading = feature.properties.heading;
      const ageMin = Math.round((nowSec - track.timeSec[index]) / 60);
      const isRecentTrack = ageMin < RECENT_TIMEOUT_MIN;
      const isActive = id === this.currentId;

      let symbol: any;
      let label: string | undefined;

      if (isEmergency) {
        this.msgSymbol.symbolLayers[0].material.color = [255, 0, 0, 1.0];
        symbol = this.msgSymbol;
      } else if (message) {
        this.msgSymbol.symbolLayers[0].material.color = [255, 255, 0, isActive || isRecentTrack ? 1 : 0.7];
        symbol = this.msgSymbol;
      } else if (heading != null) {
        // Pilot marker.
        const color = new this.api.Color(getUniqueColor(Math.round(id / 1000)));
        color.a = isActive || isRecentTrack ? 1 : 0.7;
        const rgba = color.toRgba();
        this.santaSymbol.symbolLayers[0].material.color = rgba;
        this.santaSymbol.symbolLayers[0].heading = heading + 180;
        symbol = this.santaSymbol;
        // Text.
        if (this.displayLabels && (isActive || ageMin < 12 * 60)) {
          label = track.name + ' -' + formatDurationMin(ageMin);
        }
      }

      if (!symbol) {
        continue;
      }

      const graphic = new this.api.Graphic();
      graphic.set('symbol', symbol);
      let point = new this.api.Point({
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        z: 0,
        hasZ: true,
      });
      if (this.sampler) {
        point = this.sampler.queryElevation(point) as Point;
      }
      point.z = Math.max(point.z, feature.geometry.coordinates[2] * this.multiplier);
      graphic.set('geometry', point);
      graphic.set('attributes', { liveTrackId: id, liveTrackIndex: index });
      markers.push(graphic);

      if (label) {
        const graphic = new this.api.Graphic();
        point = point.clone();
        point.z += MSG_MARKER_HEIGHT;
        graphic.set('geometry', point);
        this.txtSymbol.symbolLayers[0].text = label;
        this.txtSymbol.symbolLayers[0].material.color = isActive ? '#BF1515' : 'black';
        graphic.set('symbol', this.txtSymbol);
        graphic.set('attributes', { liveTrackId: id, liveTrackIndex: index });
        markers.push(graphic);
      }
    }

    this.layer.addMany(markers);
    this.layer.removeMany(this.markers);
    this.markers = markers;
  }

  // Display the popup when a Graphic gets clicked.
  private handleClick(graphic: Graphic, view: SceneView) {
    const attr = graphic.attributes;
    if (attr.liveTrackId != null && attr.liveTrackIndex != null && this.units) {
      const index = attr.liveTrackIndex;
      const popup = popupContent(attr.liveTrackId, index, this.units);
      if (!popup) {
        return;
      }
      store.dispatch(setCurrentLiveId(attr.liveTrackId));

      const track = liveTrackSelectors.selectById(store.getState(), attr.liveTrackId) as LiveTrack;

      this.configurePopup(view);
      view.popup.open({
        location: {
          latitude: track.lat[index],
          longitude: track.lon[index],
          z: track.alt[index] * this.multiplier + MSG_MARKER_HEIGHT,
        } as any,
        title: popup.title,
        content: popup.content,
      });
    }
  }

  private configurePopup(view: SceneView): void {
    if (this.popupConfigured) {
      return;
    }
    this.popupConfigured = true;
    view.popup.autoOpenEnabled = false;
    view.popup.actions.removeAll();
    view.popup.dockOptions = { buttonEnabled: false };
    view.popup.collapseEnabled = false;
    view.watch('popup.visible', (visible) => {
      if (visible == false) {
        store.dispatch(setCurrentLiveId(undefined));
      }
    });
  }
}
