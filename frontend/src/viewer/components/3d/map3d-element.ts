import type GraphicsLayer from 'esri/layers/GraphicsLayer';
import type SceneView from 'esri/views/SceneView';
import type NavigationToggle from 'esri/widgets/NavigationToggle';
import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  PropertyValues,
  query,
  TemplateResult,
} from 'lit-element';
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

  @query('#webgl-dialog')
  private dialog?: any;

  // ArcGis objects.
  private view?: SceneView;
  private graphicsLayer?: GraphicsLayer;

  private subscriptions: UnsubscribeHandle[] = [];
  private timestamp = 0;

  static get styles(): CSSResult {
    return css`
      .form-fields {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: flex-start;
        text-align: left;
        margin: 1rem;
        min-width: 200px;
      }
    `;
  }

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state.map);
    this.timestamp = state.map.ts;
    this.currentTrackIndex = state.map.currentTrackIndex;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('currentTrackIndex')) {
      this.centerOnMarker(16);
    }
    return super.shouldUpdate(changedProps);
  }

  connectedCallback(): void {
    super.connectedCallback();
    dispatch(act.setApiLoading(true));
    set3dUrlParam(true);
    loadApi().then((ag: Api) => {
      this.api = ag;
      const map = new ag.Map({
        basemap: 'satellite',
        ground: 'world-elevation',
      });

      this.graphicsLayer = new ag.GraphicsLayer();
      map.add(this.graphicsLayer);

      // TODO: add webgl is not supported
      this.view = new ag.SceneView({
        container: 'map',
        map,
        camera: { tilt: 80 },
        environment: { starsEnabled: false },
      });

      this.view.ui.remove('zoom');
      const controls = document.createElement('controls3d-element') as Controls3dElement;
      this.view.ui.add(controls, 'top-right');

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
          target: new this.api.Point({ latitude: lat, longitude: lon, z: alt }),
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
    this.view = undefined;
  }

  createRenderRoot(): Element {
    return this;
  }

  protected render(): TemplateResult {
    return html`
      <div id="map"></div>
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
            <line3d-element .layer=${this.graphicsLayer} .track=${track} .index=${i} .api=${this.api}></line3d-element>
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
