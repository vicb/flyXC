import './airspace3d-element';
import './controls3d-element';
import './line3d-element';
import './marker3d-element';
import './skyways3d-element';
import './tracking3d-element';

import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config';
import * as arcgisDecorators from '@arcgis/core/core/accessorSupport/decorators.js';
import { watch } from '@arcgis/core/core/reactiveUtils.js';
import Point from '@arcgis/core/geometry/Point';
import BaseElevationLayer from '@arcgis/core/layers/BaseElevationLayer';
import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SceneLayer from '@arcgis/core/layers/SceneLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Map from '@arcgis/core/Map';
import SunLighting from '@arcgis/core/views/3d/environment/SunLighting';
import VirtualLighting from '@arcgis/core/views/3d/environment/VirtualLighting';
import SceneView from '@arcgis/core/views/SceneView';
import Popup from '@arcgis/core/widgets/Popup';
import type { LatLon, LatLonAlt, RuntimeTrack } from '@flyxc/common';
import { alertController } from '@ionic/core/components';
import type { PropertyValues, TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import type { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import * as msg from '../../logic/messages';
import { setApiLoading, setTimeSec, setView3d } from '../../redux/app-slice';
import { setCurrentLiveId } from '../../redux/live-track-slice';
import { setCurrentLocation, setCurrentZoom } from '../../redux/location-slice';
import * as sel from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { setCurrentTrackId } from '../../redux/track-slice';
import type { Airspace3dElement } from './airspace3d-element';
import type { Skyways3dElement } from './skyways3d-element';

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
  @state()
  private sunEnabled = true;
  @state()
  private graphicsLayer?: GraphicsLayer;
  @state()
  private gndGraphicsLayer?: GraphicsLayer;
  @state()
  private apiLoaded = false;

  // ArcGis objects.
  private map?: Map;
  private view?: SceneView;
  // Elevation layer with exaggeration.
  private elevationLayer?: BaseElevationLayer;
  private airspace?: Airspace3dElement;
  private basemaps: Record<string, string | Basemap | null> = {
    Satellite: null,
    OpenTopoMap: null,
    'IGN France': null,
    Topo: 'topo-3d',
  };

  private subscriptions: UnsubscribeHandle[] = [];
  private previousLookAt?: LatLonAlt;
  private updateCamera = false;

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state);
    this.apiLoaded = !state.app.loadingApi;
    this.timeSec = state.app.timeSec;
    this.currentTrackId = state.track.currentTrackId;
    this.multiplier = state.arcgis.altMultiplier;
    this.updateCamera = state.track.lockOnPilot;
    this.sunEnabled = state.arcgis.useSunLighting;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('currentTrackId')) {
      this.centerOnMarker(16);
    } else if (changedProps.has('timeSec')) {
      const lookAt = sel.getLookAtLatLonAlt(store.getState())(this.timeSec);
      if (this.updateCamera && lookAt && this.view && !this.view.interacting) {
        if (this.previousLookAt) {
          const dLat = lookAt.lat - this.previousLookAt.lat;
          const dLon = lookAt.lon - this.previousLookAt.lon;
          const dAlt = lookAt.alt - this.previousLookAt.alt;
          const camera = this.view.camera.clone();
          camera.position.latitude = (camera.position.latitude ?? 0) + dLat;
          camera.position.longitude = (camera.position.longitude ?? 0) + dLon;
          camera.position.z = (camera.position.z ?? 0) + dAlt * this.multiplier;
          this.view.camera = camera;
        }
      }
      this.previousLookAt = lookAt;
    }

    if (changedProps.has('sunEnabled')) {
      this.createLighting();
      changedProps.delete('sunEnabled');
    }

    if (this.sunEnabled && changedProps.has('timeSec')) {
      (this.view?.environment?.lighting as any)?.set('date', new Date(this.timeSec * 1000));
    }

    if (changedProps.has('multiplier')) {
      changedProps.delete('multiplier');
      if (this.elevationLayer) {
        this.map?.ground.layers.remove(this.elevationLayer);
        this.elevationLayer = new ExaggeratedElevationLayer({ multiplier: this.multiplier });
        this.map?.ground.layers.add(this.elevationLayer);
      }
    }

    // timestamp updates should not cause a re-render
    changedProps.delete('timeSec');

    return super.shouldUpdate(changedProps);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
    this.view?.destroy();
    this.view = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.apiLoaded = false;
    store.dispatch(setApiLoading(true));
    // Add Arcgis CSS
    const linkHref = `${esriConfig.assetsPath}/esri/themes/light/main.css`;
    if (document.querySelector(`link[href*="${linkHref}"]`) == null) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = linkHref;
      document.head.appendChild(link);
    }
  }

  firstUpdated(): void {
    this.elevationLayer = new ExaggeratedElevationLayer({ multiplier: this.multiplier });

    const labelLayer = new SceneLayer({
      portalItem: { id: '002ce369070544f4ba55886efee41983' },
    });

    this.basemaps.Satellite = new Basemap({
      baseLayers: [
        new TileLayer({
          portalItem: { id: '10df2279f9684e4a9f6a7f08febac2a9' },
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        }),
      ],
      referenceLayers: [labelLayer],
      title: 'sat',
      id: 'sat',
    });

    this.map = new Map({
      basemap: this.basemaps.Satellite,
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
      },
      popup: new Popup({
        dockEnabled: false,
        actions: [],
        dockOptions: { buttonEnabled: false },
      }),
      // Surprising, but true (I mean false).
      popupEnabled: false,
    });
    this.view = view;
    this.createLighting();

    watch(
      () => view.popup?.visible,
      (visible) => {
        if (visible == false) {
          store.dispatch(setCurrentLiveId(undefined));
        }
      },
    );
    if (view.popup) {
      view.popup.viewModel.includeDefaultActions = false;
    }
    view.ui.remove('zoom');

    const controls = document.createElement('controls3d-element');
    view.ui.add(controls, 'top-left');

    const layerSwitcher = this.renderRoot.querySelector('#layers') as HTMLSelectElement;
    view.ui.add(layerSwitcher, 'top-right');
    view.ui.move([layerSwitcher, 'compass', 'navigation-toggle'], 'top-right');

    const skyways = document.createElement('skyways3d-element') as Skyways3dElement;
    skyways.map = this.map;
    view.ui.add(skyways, 'top-left');

    this.airspace = document.createElement('airspace3d-element') as Airspace3dElement;
    this.airspace.map = this.map;
    view.ui.add(this.airspace, 'top-left');

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

        if (this.tracks.length) {
          // Zoom to tracks when there are some.
          this.centerOnMarker(16);
        } else {
          const { location, zoom } = store.getState().location;
          this.center({ ...location, alt: 0 }, zoom);
        }

        watch(
          () => view.center,
          (point?: Point) => {
            if (point) {
              this.handleLocation({ lat: point.latitude ?? 0, lon: point.longitude ?? 0 });
            }
          },
        );
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
          this.airspace?.handleClick({ lat: e.mapPoint.latitude ?? 0, lon: e.mapPoint.longitude ?? 0 }, view);
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

    this.basemaps['IGN France'] = new Basemap({
      baseLayers: [
        new VectorTileLayer({
          url: 'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/classique.json',
        }),
      ],
      title: 'IGN',
      id: 'ignfr',
    });
  }

  private createLighting() {
    if (this.view?.environment) {
      if (this.sunEnabled) {
        this.view.environment.lighting = new SunLighting({
          date: new Date(this.timeSec * 1000),
          cameraTrackingEnabled: false,
        });
      } else {
        this.view.environment.lighting = new VirtualLighting();
      }
    }
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
      </style>
      <div id="map3d"></div>
      <select id="layers" @change=${(e: any) => this.map?.set('basemap', this.basemaps[e.target.value])}>
        ${Object.getOwnPropertyNames(this.basemaps).map((name) => html`<option value="${name}">${name}</option>`)}
      </select>
      ${when(
        this.graphicsLayer != null && this.apiLoaded,
        () => html`<tracking3d-element
            .layer=${this.graphicsLayer}
            .gndLayer=${this.gndGraphicsLayer}
            .sampler=${this.view?.groundView.elevationSampler}
          >
          </tracking3d-element>
          ${repeat(
            this.tracks,
            (track) => track.id,
            (track) =>
              html`
                <line3d-element
                  .track=${track}
                  .layer=${this.graphicsLayer}
                  .gndLayer=${this.gndGraphicsLayer}
                ></line3d-element>
                <marker3d-element .track=${track} .layer=${this.graphicsLayer}></marker3d-element>
              `,
          )} `,
      )}
    `;
  }

  private handleLocation(center: LatLon): void {
    store.dispatch(setCurrentLocation(center));
    store.dispatch(setCurrentZoom(this.view?.zoom ?? 10));
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@arcgisDecorators.subclass()
class ExaggeratedElevationLayer extends BaseElevationLayer {
  @arcgisDecorators.property()
  multiplier = 1;
  @arcgisDecorators.property()
  _elevation: ElevationLayer | undefined;

  constructor(properties: __esri.BaseElevationLayerProperties & { multiplier: number }) {
    super(properties);
    this.multiplier = properties.multiplier;
  }

  load(): Promise<void> {
    this._elevation = new ElevationLayer({
      url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    });
    const loadPromise = this._elevation.load();
    this.addResolvingPromise(loadPromise);
    return loadPromise;
  }

  async fetchTile(
    level: number,
    row: number,
    col: number,
    options?: __esri.BaseElevationLayerFetchTileOptions,
  ): Promise<__esri.ElevationTileData> {
    if (!this._elevation) {
      return {} as any;
    }
    const data = await this._elevation.fetchTile(level, row, col, options);
    if (data.values) {
      for (let i = 0; i < data.values.length; i++) {
        data.values[i] *= this.multiplier;
      }
    }
    return data;
  }
}
