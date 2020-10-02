import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import type SceneView from 'esri/views/SceneView';
import type NavigationToggle from 'esri/widgets/NavigationToggle';
import type Map from 'esri/Map';
import type Basemap from 'esri/Basemap';
import type BaseElevationLayer from 'esri/layers/BaseElevationLayer';
import { customElement, html, internalProperty, LitElement, PropertyValues, query, TemplateResult } from 'lit-element';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { LatLon, RuntimeTrack } from '../../../../../common/track';
import * as act from '../../actions';
import { Api, loadApi } from '../../logic/arcgis';
import { set3dUrlParam } from '../../logic/history';
import * as msg from '../../logic/messages';
import * as sel from '../../selectors';
import { dispatch, RootState, store } from '../../store';
import { Controls3dElement } from './controls3d-element';
import { Line3dElement } from './line3d-element';
import { Marker3dElement } from './marker3d-element';

export { Line3dElement, Marker3dElement, Controls3dElement };

@customElement('map3d-element')
export class Map3dElement extends connect(store)(LitElement) {
  @internalProperty()
  private tracks: RuntimeTrack[] = [];

  @internalProperty()
  private api?: Api;

  @internalProperty()
  protected currentTrackIndex = 0;

  @internalProperty()
  private multiplier = 1;

  @query('#webgl-dialog')
  private dialog?: any;

  // ArcGis objects.
  private map?: Map;
  private view?: SceneView;
  private graphicsLayer?: GraphicsLayer;
  private gndGraphicsLayer?: GraphicsLayer;
  // Elevation layer with exageration.
  private elevationLayer?: BaseElevationLayer;
  private basemaps: Record<string, string | Basemap | null> = {
    Satellite: 'satellite',
    OpenTopoMap: null,
    Terrain: 'terrain',
  };

  private subscriptions: UnsubscribeHandle[] = [];
  private timestamp = 0;

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state.map);
    this.timestamp = state.map.ts;
    this.currentTrackIndex = state.map.currentTrackIndex;
    this.multiplier = state.map.altMultiplier;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('currentTrackIndex')) {
      this.centerOnMarker(16);
    }
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

  connectedCallback(): void {
    super.connectedCallback();
    dispatch(act.setApiLoading(true));
    set3dUrlParam(true);
    loadApi().then((ag: Api) => {
      this.api = ag;
      this.elevationLayer = createElevationLayer(ag, this.multiplier);

      this.map = new ag.Map({
        basemap: 'satellite',
        ground: { layers: [this.elevationLayer] },
      });

      this.graphicsLayer = new ag.GraphicsLayer();
      this.gndGraphicsLayer = new ag.GraphicsLayer({ elevationInfo: { mode: 'on-the-ground' } });
      this.map.addMany([this.graphicsLayer, this.gndGraphicsLayer]);

      // TODO: add webgl is not supported
      this.view = new ag.SceneView({
        container: 'map',
        map: this.map,
        camera: { tilt: 80 },
        environment: { starsEnabled: false },
      });

      this.view.ui.remove('zoom');
      const controls = document.createElement('controls3d-element') as Controls3dElement;
      this.view.ui.add(controls, 'top-right');

      const layerSwitcher = this.renderRoot.querySelector('#layers') as HTMLSelectElement;
      this.view.ui.add(layerSwitcher, 'top-left');
      this.view.ui.move([layerSwitcher, 'compass', 'navigation-toggle'], 'top-left');

      // "Control" key sets the navigation mode to "rotate".
      const toggle = this.view.ui.find('navigation-toggle') as NavigationToggle;
      this.view.on('key-down', (e: any) => {
        if (e.key == 'Control' && !e.repeat) {
          toggle.toggle();
        }
      });
      this.view.on('key-up', (e: any) => {
        if (e.key == 'Control') {
          toggle.toggle();
        }
      });

      this.subscriptions.push(
        msg.centerMap.subscribe(() => this.centerOnMarker()),
        msg.centerZoomMap.subscribe((_, delta) => this.centerAndZoom(delta)),
        msg.tracksAdded.subscribe(() => this.centerOnMarker(this.view?.zoom)),
        msg.tracksRemoved.subscribe(() => this.centerOnMarker(this.view?.zoom)),
        msg.requestLocation.subscribe(() => this.updateLocation()),
        msg.geoLocation.subscribe((latLon) => this.geolocation(latLon)),
      );

      this.view
        .when(() => {
          dispatch(act.setApiLoading(false));
          const location = store.getState().map.location;

          if (this.tracks.length) {
            // Zoom to tracks when there are some.
            this.centerOnMarker(16);
          } else {
            // Otherwise go to (priority order):
            // - location on the 3d map,
            // - gps location,
            // - initial location.
            let latLon = location.geoloc || location.start;
            let zoom = 11;
            if (location.current) {
              latLon = location.current.latLon;
              zoom = location.current.zoom;
            }
            this.center(latLon, zoom);
          }
        })
        .catch((e) => {
          if (e.name.includes('webgl')) {
            this.openWebGlDialog();
          }
        });

      // Set the active track when clicking on a track, marker, label.
      this.view.on('click', (e) => {
        this.view?.hitTest(e).then(({ results }) => {
          if (results.length > 0) {
            // Sort hits by their distance to the camera.
            results.sort((r1, r2) => r1.distance - r2.distance);
            const index = results[0].graphic.attributes.index;
            if (index != null) {
              dispatch(act.setCurrentTrack(index));
            }
          }
        });
      });

      // Horizontal wheel movements update the timestamp.
      this.view.on('mouse-wheel', (e) => {
        if (e.native.deltaX == 0 || e.native.deltaY != 0) {
          // Capture only X scroll (either physical of shift + wheel).
          return;
        }
        const direction = Math.sign(e.native.deltaX);
        const map = store.getState().map;
        const minTs = sel.minTs(map);
        const maxTs = sel.maxTs(map);
        const delta = Math.round((direction * (maxTs - minTs)) / 300) + 1;
        const ts = Math.max(Math.min(map.ts + delta, maxTs), minTs);
        dispatch(act.setTimestamp(ts));
        e.stopPropagation();
      });

      this.basemaps.OpenTopoMap = new ag.Basemap({
        baseLayers: [
          new ag.WebTileLayer({
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

  private centerOnMarker(zoom?: number): void {
    const latLon = sel.getTrackLatLon(store.getState().map)(this.timestamp);
    if (latLon != null) {
      this.center(latLon, zoom);
    }
  }

  private center({ lat, lon, alt }: LatLon, zoom?: number): void {
    if (this.view && this.api) {
      this.view.goTo(
        {
          target: new this.api.Point({ latitude: lat, longitude: lon, z: this.multiplier * (alt ?? 0) }),
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

  private centerAndZoom(delta: number): void {
    if (this.view) {
      this.centerOnMarker(this.view.zoom + (delta < 0 ? 0.3 : -0.3));
    }
  }

  // Center the map on the user location if they have not yet interacted with the map.
  private geolocation({ lat, lon }: LatLon): void {
    if (this.view) {
      const center = this.view.center;
      const start = store.getState().map.location.start;
      if (center.latitude == start.lat && center.longitude == start.lon) {
        this.center({ lat, lon });
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
    this.view?.destroy();
    this.view = undefined;
  }

  createRenderRoot(): Element {
    return this;
  }

  protected render(): TemplateResult {
    return html`
      <style>
        #layers {
          font: 18px Roboto, arial, sans-serif !important;
        }
      </style>
      <div id="map"></div>
      <select id="layers" @change=${(e: any) => this.map?.set('basemap', this.basemaps[e.target.value])}>
        ${Object.getOwnPropertyNames(this.basemaps).map((name) => html`<option value="${name}">${name}</option>`)}
      </select>
      <ui5-dialog id="webgl-dialog" header-text="Error">
        <section class="form-fields">
          <div>
            <ui5-label
              >Sorry, the 3d mode requires WebGL which does not seem to be supported on your platform.</ui5-label
            >
          </div>
        </section>
        <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
          <div style="flex: 1"></div>
          <ui5-button design="Emphasized" @click=${this.closeWebGlDialog}>Back to 2d</ui5-button>
        </div>
      </ui5-dialog>
      ${this.tracks.map(
        (track, i) =>
          html`
            <line3d-element
              .layer=${this.graphicsLayer}
              .gndLayer=${this.gndGraphicsLayer}
              .track=${track}
              .index=${i}
              .api=${this.api}
            ></line3d-element>
            <marker3d-element
              .layer=${this.graphicsLayer}
              .track=${track}
              .index=${i}
              .api=${this.api}
            ></marker3d-element>
          `,
      )}
    `;
  }

  private openWebGlDialog(): void {
    this.dialog?.open();
  }

  private closeWebGlDialog(): void {
    this.dialog?.close();
    dispatch(act.setView3d(false));
  }

  private updateLocation(): void {
    if (this.view) {
      const center = this.view.center;
      store.dispatch(act.setCurrentLocation({ lat: center.latitude, lon: center.longitude }, this.view.zoom));
    }
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
