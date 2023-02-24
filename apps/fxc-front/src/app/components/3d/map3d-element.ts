import './airspace3d-element';
import './airways3d-element';
import './controls3d-element';
import './line3d-element';
import './marker3d-element';

import { LatLon, LatLonAlt, RuntimeTrack } from '@flyxc/common';
import { html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import Basemap from '@arcgis/core/Basemap';
import Point from '@arcgis/core/geometry/Point';
import BaseElevationLayer from '@arcgis/core/layers/BaseElevationLayer';
import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Map from '@arcgis/core/Map';
import SceneView from '@arcgis/core/views/SceneView';
import NavigationToggle from '@arcgis/core/widgets/NavigationToggle';
import { alertController } from '@ionic/core/components';

import * as msg from '../../logic/messages';
import { setApiLoading, setTimeSec, setView3d } from '../../redux/app-slice';
import { setElevationSampler, setGndGraphicsLayer, setGraphicsLayer } from '../../redux/arcgis-slice';
import { setCurrentLiveId } from '../../redux/live-track-slice';
import { setCurrentLocation, setCurrentZoom } from '../../redux/location-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { setCurrentTrackId } from '../../redux/track-slice';
import { Airspace3dElement } from './airspace3d-element';
import { Airways3dElement } from './airways3d-element';

@customElement('map3d-element')
export class Map3dElement extends connect(store)(LitElement) {
  @state()
  private tracks: RuntimeTrack[] = [];
  @state()
  protected currentTrackId?: string;
  @state()
  private multiplier = 1;
  @state()
  private timeSec = 0;

  // ArcGis objects.
  private map?: Map;
  private view?: SceneView;
  private graphicsLayer?: GraphicsLayer;
  private gndGraphicsLayer?: GraphicsLayer;
  // Elevation layer with exaggeration.
  private elevationLayer?: BaseElevationLayer;
  private airspace?: Airspace3dElement;
  private basemaps: Record<string, string | Basemap | null> = {
    Satellite: 'satellite',
    OpenTopoMap: null,
    Terrain: 'terrain',
  };

  private subscriptions: UnsubscribeHandle[] = [];
  private previousLookAt?: LatLonAlt;
  private updateCamera = false;
  private originalQuality = 'medium';
  private qualityTimer?: number;
  private readonly adRatio = store.getState().browser.isSmallScreen ? 0.7 : 1;

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state);
    this.timeSec = state.app.timeSec;
    this.currentTrackId = state.track.currentTrackId;
    this.multiplier = state.arcgis.altMultiplier;
    this.updateCamera = state.track.lockOnPilot;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('currentTrackId')) {
      this.centerOnMarker(16);
    } else if (changedProps.has('timeSec')) {
      const lookAt = sel.getLookAtLatLonAlt(store.getState())(this.timeSec);
      if (this.updateCamera && lookAt && this.view && !this.view.interacting) {
        if (this.previousLookAt) {
          // Lower the qualityProfile while animating.
          if (this.qualityTimer) {
            clearTimeout(this.qualityTimer);
          }
          this.qualityTimer = window.setTimeout(() => {
            this.view?.set('qualityProfile', this.originalQuality);
            this.qualityTimer = undefined;
          }, 500);
          this.view.set('qualityProfile', 'low');
          const dLat = lookAt.lat - this.previousLookAt.lat;
          const dLon = lookAt.lon - this.previousLookAt.lon;
          const dAlt = lookAt.alt - this.previousLookAt.alt;
          const camera = this.view.camera.clone();
          camera.position.latitude += dLat;
          camera.position.longitude += dLon;
          camera.position.z += dAlt * this.multiplier;
          this.view.camera = camera;
        }
      }
      this.previousLookAt = lookAt;
    }

    // timestamp updates should not cause a re-render
    changedProps.delete('timeSec');

    if (changedProps.has('multiplier')) {
      changedProps.delete('multiplier');
      if (this.elevationLayer) {
        this.map?.ground.layers.remove(this.elevationLayer as any);
        this.elevationLayer = createElevationLayer(this.multiplier);
        this.map?.ground.layers.add(this.elevationLayer as any);
      }
    }

    return super.shouldUpdate(changedProps);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
    store.dispatch(setGraphicsLayer(undefined));
    store.dispatch(setGndGraphicsLayer(undefined));
    store.dispatch(setElevationSampler(undefined));
    this.view?.destroy();
    this.view = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    store.dispatch(setApiLoading(true));
  }

  firstUpdated(): void {
    this.elevationLayer = createElevationLayer(this.multiplier);

    this.map = new Map({
      basemap: 'satellite',
      ground: { layers: [this.elevationLayer] },
    });

    this.graphicsLayer = new GraphicsLayer();
    this.gndGraphicsLayer = new GraphicsLayer({ elevationInfo: { mode: 'on-the-ground' } });
    this.map.addMany([this.graphicsLayer, this.gndGraphicsLayer]);

    const view = new SceneView({
      container: 'map3d',
      map: this.map,
      camera: { tilt: 80 },
      environment: {
        starsEnabled: false,
        atmosphereEnabled: true,
        atmosphere: { quality: 'high' },
      },
    });
    this.view = view;
    this.configurePopup(view);

    store.dispatch(setGraphicsLayer(this.graphicsLayer));
    store.dispatch(setGndGraphicsLayer(this.gndGraphicsLayer));

    view.ui.remove('zoom');

    const controls = document.createElement('controls3d-element');
    view.ui.add(controls, 'top-right');

    if (!store.getState().browser.isFromFfvl) {
      const ad = document.createElement('a');
      ad.setAttribute('href', 'https://www.niviuk.com/');
      ad.setAttribute('target', '_blank');
      ad.className = 'ad';
      ad.innerHTML = `<img width="${Math.round(175 * this.adRatio)}" height="${Math.round(
        40 * this.adRatio,
      )}" src="/static/img/niviuk.svg">`;
      view.ui.add(ad);
    }

    const layerSwitcher = this.renderRoot.querySelector('#layers') as HTMLSelectElement;
    view.ui.add(layerSwitcher, 'top-left');
    view.ui.move([layerSwitcher, 'compass', 'navigation-toggle'], 'top-left');

    const airways = document.createElement('airways3d-element') as Airways3dElement;
    airways.map = this.map;
    view.ui.add(airways, 'top-right');

    this.airspace = document.createElement('airspace3d-element') as Airspace3dElement;
    this.airspace.map = this.map;
    view.ui.add(this.airspace, 'top-right');

    this.originalQuality = view.qualityProfile;

    // "Control" key sets the navigation mode to "rotate".
    const toggle = view.ui.find('navigation-toggle') as NavigationToggle;
    view.on('key-down', (e: any) => {
      if (e.key == 'Control' && !e.repeat) {
        toggle.toggle();
      }
    });
    view.on('key-up', (e: any) => {
      if (e.key == 'Control') {
        toggle.toggle();
      }
    });

    this.subscriptions.push(
      msg.centerMap.subscribe((ll) => this.center(ll)),
      msg.centerZoomMap.subscribe((ll, delta) => this.centerZoom(ll, delta)),
      msg.trackGroupsAdded.subscribe(() => this.centerOnMarker(view.zoom)),
      msg.trackGroupsRemoved.subscribe(() => this.centerOnMarker(view.zoom)),
      msg.geoLocation.subscribe((latLon, userInitiated) => this.geolocation(latLon, userInitiated)),
    );

    view
      .when(() => {
        store.dispatch(setApiLoading(false));
        store.dispatch(setElevationSampler(view.groundView.elevationSampler));

        if (this.tracks.length) {
          // Zoom to tracks when there are some.
          this.centerOnMarker(16);
        } else {
          const { location, zoom } = store.getState().location;
          this.center({ ...location, alt: 0 }, zoom);
        }

        view.watch('center', (point: Point) => this.handleLocation({ lat: point.latitude, lon: point.longitude }));
      })
      .catch(async (e) => {
        store.dispatch(setApiLoading(false));
        if (e.name.includes('webgl')) {
          const alert = await alertController.create({
            header: 'WebGL Error',
            message: 'Sorry, 3d requires WebGL which does not seem to be supported on your platform.',
            buttons: [
              {
                text: 'Ok',
                role: 'cancel',
              },
            ],
          });
          await alert.present();
          store.dispatch(setView3d(false));
        }
      });

    // Set the active track when clicking on a track, marker, label.
    view.on('click', (e) => {
      view.hitTest(e).then(({ results }: { results: any[] }) => {
        if (results.length > 0) {
          // Sort hits by their distance to the camera.
          results.sort((r1, r2) => r1.distance - r2.distance);
          const graphic = results[0].graphic;
          msg.clickSceneView.emit(graphic, view);
          // The trackId is set on tracks and pilots (not on live tracks).
          const trackId = graphic.attributes?.trackId;
          if (trackId != null) {
            store.dispatch(setCurrentTrackId(trackId));
          }
        } else {
          this.airspace?.handleClick({ lat: e.mapPoint.latitude, lon: e.mapPoint.longitude }, view);
        }
      });
    });

    // Horizontal wheel movements update the timestamp.
    view.on('mouse-wheel', (e) => {
      if (e.native.deltaX == 0 || e.native.deltaY != 0) {
        // Capture only X scroll (either physical of shift + wheel).
        return;
      }
      const direction = Math.sign(e.native.deltaX);
      const state = store.getState();
      const minTimeSec = sel.minTimeSec(state);
      const maxTimeSec = sel.maxTimeSec(state);
      const delta = Math.round((direction * (maxTimeSec - minTimeSec)) / 300) + 1;
      const ts = Math.max(Math.min(state.app.timeSec + delta, maxTimeSec), minTimeSec);
      store.dispatch(setTimeSec(ts));
      e.stopPropagation();
    });

    this.basemaps.OpenTopoMap = new Basemap({
      baseLayers: [
        new WebTileLayer({
          urlTemplate: 'https://{subDomain}.tile.opentopomap.org/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c'],
          copyright:
            'Map tiles by <a href="https://opentopomap.org/">OpenTopoMap</a>, ' +
            'under <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>. ' +
            'Data by <a href="http://openstreetmap.org/">OpenStreetMap</a>, ' +
            'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.',
        }),
      ],
      title: 'otm',
      id: 'otm',
    });
  }

  // Center the map on the position and optionally set the zoom.
  private center(latLon: LatLonAlt, zoom?: number): void {
    this.previousLookAt = latLon;
    if (this.view?.center) {
      const { lat, lon, alt } = latLon;
      this.view.center = new Point({ latitude: lat, longitude: lon, z: alt });
      if (zoom != null) {
        this.view.zoom = zoom;
      }
    }
  }

  private centerZoom(ll: LatLonAlt, delta: number): void {
    if (this.view) {
      this.center(ll, this.view.zoom + (delta < 0 ? 0.3 : -0.3));
    }
  }

  private centerOnMarker(zoom?: number): void {
    const latLon = sel.getTrackLatLonAlt(store.getState())(this.timeSec);
    this.previousLookAt = latLon;
    if (latLon && this.view) {
      const { lat, lon, alt } = latLon;
      this.view.goTo(
        {
          target: new Point({ latitude: lat, longitude: lon, z: this.multiplier * alt }),
          zoom: zoom ?? this.view.zoom,
          heading: this.view.camera.heading,
          tilt: this.view.camera.tilt,
        },
        {
          animate: false,
        },
      );
    }
  }

  // Center the map on the user location:
  // - if they have not yet interacted with the map,
  // - or if the request was initiated by them (i.e. from the menu).
  private geolocation({ lat, lon }: LatLon, userInitiated: boolean): void {
    if (this.view) {
      const center = this.view.center;
      const start = store.getState().location.start;
      if (userInitiated || (center?.latitude == start.lat && center?.longitude == start.lon)) {
        this.center({ lat, lon, alt: 0 });
      }
    }
  }

  protected render(): TemplateResult {
    return html`
      <style>
        #layers {
          font: 18px Roboto, arial, sans-serif !important;
        }
        .ad {
          box-shadow: none;
          bottom: 10px;
          left: 50%;
          transform: translate(-50%, 0);
        }
      </style>
      <div id="map3d"></div>
      <select id="layers" @change=${(e: any) => this.map?.set('basemap', this.basemaps[e.target.value])}>
        ${Object.getOwnPropertyNames(this.basemaps).map((name) => html`<option value="${name}">${name}</option>`)}
      </select>
      ${repeat(
        this.tracks,
        (track) => track.id,
        (track) =>
          html`
            <line3d-element .track=${track}></line3d-element>
            <marker3d-element .track=${track}></marker3d-element>
          `,
      )}
    `;
  }

  private handleLocation(center: LatLon): void {
    store.dispatch(setCurrentLocation(center));
    store.dispatch(setCurrentZoom(this.view?.zoom ?? 10));
  }

  createRenderRoot(): Element {
    return this;
  }

  private configurePopup(view: SceneView): void {
    view.popup.autoOpenEnabled = false;
    view.popup.actions.removeAll();
    view.popup.dockOptions = { buttonEnabled: false };
    view.popup.collapseEnabled = false;
    view.popup.viewModel.includeDefaultActions = false;
    view.watch('popup.visible', (visible) => {
      if (visible == false) {
        store.dispatch(setCurrentLiveId(undefined));
      }
    });
  }
}

let Layer: any;

// Creates a layer with exaggeration.
// See https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-BaseElevationLayer.html
function createElevationLayer(multiplier = 1): BaseElevationLayer {
  if (!Layer) {
    Layer = (BaseElevationLayer as any).createSubclass({
      properties: {
        // exaggeration multiplier.
        multiplier: 1,
      },
      load: function () {
        this._elevation = new ElevationLayer({
          url: '//elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
        });
      },
      fetchTile: function (level: number, row: number, col: number, options: unknown) {
        return this._elevation.fetchTile(level, row, col, options).then((data: { values?: number[] }) => {
          if (data.values) {
            for (let i = 0; i < data.values.length; i++) {
              data.values[i] *= this.multiplier;
            }
          }
          return data;
        });
      },
    });
  }

  const layer = new Layer();
  layer.multiplier = multiplier;
  return layer;
}
