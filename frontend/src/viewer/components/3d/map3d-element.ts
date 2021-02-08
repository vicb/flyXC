import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import type SceneView from 'esri/views/SceneView';
import type NavigationToggle from 'esri/widgets/NavigationToggle';
import type Map from 'esri/Map';
import type Basemap from 'esri/Basemap';
import type BaseElevationLayer from 'esri/layers/BaseElevationLayer';
import './line3d-element';
import './marker3d-element';
import './controls3d-element';

import { LatLon, LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, html, internalProperty, LitElement, PropertyValues, TemplateResult } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { Api, loadApi } from '../../logic/arcgis';
import * as msg from '../../logic/messages';
import { setApiLoading, setTimestamp, setView3d } from '../../redux/app-slice';
import { setApi, setElevationSampler, setGndGraphicsLayer, setGraphicsLayer } from '../../redux/arcgis-slice';
import { setCurrentLocation } from '../../redux/location-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { setCurrentTrackId } from '../../redux/track-slice';
import { getAlertController } from '../ui/ion-controllers';

@customElement('map3d-element')
export class Map3dElement extends connect(store)(LitElement) {
  @internalProperty()
  private tracks: RuntimeTrack[] = [];
  @internalProperty()
  private api?: Api;
  @internalProperty()
  protected currentTrackId?: string;
  @internalProperty()
  private multiplier = 1;
  @internalProperty()
  private timestamp = 0;

  // ArcGis objects.
  private map?: Map;
  private view?: SceneView;
  private graphicsLayer?: GraphicsLayer;
  private gndGraphicsLayer?: GraphicsLayer;
  // Elevation layer with exaggeration.
  private elevationLayer?: BaseElevationLayer;
  private basemaps: Record<string, string | Basemap | null> = {
    Satellite: 'satellite',
    OpenTopoMap: null,
    Terrain: 'terrain',
  };

  private subscriptions: UnsubscribeHandle[] = [];
  private previousLookAt?: LatLonZ;
  private updateCamera = false;
  private originalQuality = 'medium';
  private qualityTimer?: number;
  private readonly adRatio = store.getState().browser.isSmallScreen ? 0.7 : 1;

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state);
    this.timestamp = state.app.timestamp;
    this.currentTrackId = state.track.currentTrackId;
    this.multiplier = state.arcgis.altMultiplier;
    this.updateCamera = state.app.lockOnPilot;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('currentTrackId')) {
      this.centerOnMarker(16);
    } else if (changedProps.has('timestamp')) {
      const lookAt = sel.getLookAtLatLonAlt(store.getState())(this.timestamp);
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
    changedProps.delete('timestamp');

    if (changedProps.has('multiplier')) {
      changedProps.delete('multiplier');
      if (this.elevationLayer && this.api) {
        this.map?.ground.layers.remove(this.elevationLayer as any);
        this.elevationLayer = createElevationLayer(this.api, this.multiplier);
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
    store.dispatch(setApi(undefined));
    store.dispatch(setElevationSampler(undefined));
    this.view?.destroy();
    this.view = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    store.dispatch(setApiLoading(true));
    loadApi().then((api: Api) => {
      this.api = api;
      this.elevationLayer = createElevationLayer(api, this.multiplier);

      this.map = new api.Map({
        basemap: 'satellite',
        ground: { layers: [this.elevationLayer] },
      });

      this.graphicsLayer = new api.GraphicsLayer();
      this.gndGraphicsLayer = new api.GraphicsLayer({ elevationInfo: { mode: 'on-the-ground' } });
      this.map.addMany([this.graphicsLayer, this.gndGraphicsLayer]);

      const view = new api.SceneView({
        container: 'map',
        map: this.map,
        camera: { tilt: 80 },
        environment: { starsEnabled: false },
      });
      this.view = view;

      store.dispatch(setApi(api));
      store.dispatch(setGraphicsLayer(this.graphicsLayer));
      store.dispatch(setGndGraphicsLayer(this.gndGraphicsLayer));

      view.ui.remove('zoom');
      const controls = document.createElement('controls3d-element');
      view.ui.add(controls, 'top-right');

      const ad = document.createElement('a');
      ad.setAttribute('href', 'https://www.flyozone.com/');
      ad.setAttribute('target', '_blank');
      ad.className = 'ad';
      ad.innerHTML = `<img width="${Math.round(210 * this.adRatio)}" height="${Math.round(
        35 * this.adRatio,
      )}" src="img/ozone.svg">`;
      view.ui.add(ad);

      const layerSwitcher = this.renderRoot.querySelector('#layers') as HTMLSelectElement;
      view.ui.add(layerSwitcher, 'top-left');
      view.ui.move([layerSwitcher, 'compass', 'navigation-toggle'], 'top-left');

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
        msg.requestLocation.subscribe(() => this.updateLocation()),
        msg.geoLocation.subscribe((latLon) => this.geolocation(latLon)),
      );

      view
        .when(() => {
          store.dispatch(setApiLoading(false));
          store.dispatch(setElevationSampler(view.groundView.elevationSampler));
          const location = store.getState().location;

          if (this.tracks.length) {
            // Zoom to tracks when there are some.
            this.centerOnMarker(16);
          } else {
            // Otherwise go to (priority order):
            // - location on the 3d map,
            // - gps location,
            // - initial location.
            let latLon = location.geolocation || location.start;
            let zoom = 11;
            if (location.current) {
              latLon = location.current.latLon;
              zoom = location.current.zoom;
            }
            this.center({ ...latLon, alt: 0 }, zoom);
          }
        })
        .catch(async (e) => {
          store.dispatch(setApiLoading(false));
          if (e.name.includes('webgl')) {
            const alert = await getAlertController().create({
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
        view.hitTest(e).then(({ results }) => {
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
        const minTs = sel.minTimestamp(state);
        const maxTs = sel.maxTimestamp(state);
        const delta = Math.round((direction * (maxTs - minTs)) / 300) + 1;
        const ts = Math.max(Math.min(state.app.timestamp + delta, maxTs), minTs);
        store.dispatch(setTimestamp(ts));
        e.stopPropagation();
      });

      this.basemaps.OpenTopoMap = new api.Basemap({
        baseLayers: [
          new api.WebTileLayer({
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
    });
  }

  // Center the map on the position and optionally set the zoom.
  private center(latLon: LatLonZ, zoom?: number): void {
    this.previousLookAt = latLon;
    if (this.view?.center && this.api) {
      const { lat, lon, alt } = latLon;
      this.view.center = new this.api.Point({ latitude: lat, longitude: lon, z: alt });
      if (zoom != null) {
        this.view.zoom = zoom;
      }
    }
  }

  private centerZoom(ll: LatLonZ, delta: number): void {
    if (this.view) {
      this.center(ll, this.view.zoom + (delta < 0 ? 0.3 : -0.3));
    }
  }

  private centerOnMarker(zoom?: number): void {
    const latLon = sel.getTrackLatLonAlt(store.getState())(this.timestamp);
    this.previousLookAt = latLon;
    if (latLon && this.view && this.api) {
      const { lat, lon, alt } = latLon;
      this.view.goTo(
        {
          target: new this.api.Point({ latitude: lat, longitude: lon, z: this.multiplier * alt }),
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

  // Center the map on the user location if they have not yet interacted with the map.
  private geolocation({ lat, lon }: LatLon): void {
    if (this.view) {
      const center = this.view.center;
      const start = store.getState().location.start;
      // center might not be initialized yet.
      if (center?.latitude == start.lat && center?.longitude == start.lon) {
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
      <div id="map"></div>
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

  private updateLocation(): void {
    if (this.view) {
      const center = this.view.center;
      store.dispatch(setCurrentLocation({ lat: center.latitude, lon: center.longitude }, this.view.zoom));
    }
  }

  createRenderRoot(): Element {
    return this;
  }
}

let Layer: any;

// Creates a layer with exaggeration.
// See https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-BaseElevationLayer.html
function createElevationLayer(ag: Api, multiplier = 1): BaseElevationLayer {
  if (!Layer) {
    Layer = (ag.BaseElevationLayer as any).createSubclass({
      properties: {
        // exaggeration multiplier.
        multiplier: 1,
      },
      load: function () {
        this._elevation = new ag.ElevationLayer({
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
