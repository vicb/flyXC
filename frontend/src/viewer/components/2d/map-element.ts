import { customElement, html, internalProperty, LitElement, property, TemplateResult } from 'lit-element';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { findClosestFix } from '../../../../../common/distance';
import { LatLon, RuntimeTrack } from '../../../../../common/track';
import { getApiKey } from '../../../apikey';
import * as act from '../../actions';
import { getUrlParam, ParamNames, set3dUrlParam } from '../../logic/history';
import * as msg from '../../logic/messages';
import * as sel from '../../selectors';
import { dispatch, RootState, store } from '../../store';
import { ControlsElement } from './controls-element';
import { LineElement } from './line-element';
import { MarkerElement } from './marker-element';
import { PlannerElement } from './planner-element';
import { SegmentsElement } from './segments-element';
import { TopoEu, TopoFrance, TopoOtm, TopoSpain } from './topo-elements';
import { TrackingElement } from './tracking-element';

// Prevent tree-shaking components by exporting them
export {
  ControlsElement,
  LineElement,
  MarkerElement as GmMarkerElement,
  PlannerElement,
  SegmentsElement,
  TopoEu,
  TopoSpain,
  TopoFrance,
  TopoOtm,
  TrackingElement,
};

// Load the google maps api
declare global {
  interface Window {
    initMap: () => void;
  }
}

let apiPromise: Promise<void> | undefined;

// Load google maps
function loadApi(): Promise<void> {
  if (!apiPromise) {
    let apiLoaded = (): void => undefined;
    window.initMap = () => apiLoaded();
    apiPromise = new Promise<void>((resolve) => (apiLoaded = resolve));
    const tracks = getUrlParam(ParamNames.TRACK_URL);
    const loader = document.createElement('script');
    loader.src = `https://maps.googleapis.com/maps/api/js?key=${getApiKey(
      'gmaps',
      tracks[0],
    )}&libraries=geometry&callback=initMap&v=beta&map_ids=997ff70df48844a5`;
    document.head.appendChild(loader);
  }
  return apiPromise;
}

@customElement('map-element')
export class MapElement extends connect(store)(LitElement) {
  @property()
  map: google.maps.Map | undefined;

  @internalProperty()
  private tracks: RuntimeTrack[] = [];

  @internalProperty()
  private timestamp = 0;

  @internalProperty()
  private currentTrackIndex = 0;

  private subscriptions: UnsubscribeHandle[] = [];

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state.map);
    this.timestamp = state.map.ts;
    this.currentTrackIndex = state.map.currentTrackIndex;
    // In full screen mode the gesture handling must be greedy.
    // Using ctrl (+ scroll) is unnecessary as thr page can not scroll anyway.
    this.map?.setOptions({ gestureHandling: state.map.fullscreen ? 'greedy' : 'auto' });
  }

  connectedCallback(): void {
    super.connectedCallback();
    dispatch(act.setApiLoading(true));
    set3dUrlParam(false);
    loadApi().then((): void => {
      const options: google.maps.MapOptions = {
        center: { lat: 45, lng: 0 },
        zoom: 5,
        minZoom: 3,
        // Google maps terrain is only available up to zoom level 17.
        maxZoom: 17,
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        scaleControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControlOptions: {
          mapTypeIds: [
            'terrain',
            'satellite',
            TopoOtm.mapTypeId,
            TopoFrance.mapTypeId,
            TopoFrance.mapTypeIdScan,
            TopoEu.mapTypeId,
            TopoSpain.mapTypeId,
          ],
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        },
      };

      // Do not enable the webgl renderer on mobile devices as it is slow to load.
      if (!store.getState().map.isMobile) {
        (options as any).mapId = '997ff70df48844a5';
        (options as any).useStaticMap = true;
      }

      this.map = new google.maps.Map(this.querySelector('#map') as Element, options);

      const controls = document.createElement('controls-element') as ControlsElement;
      controls.map = this.map;
      this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controls);

      this.map.addListener('click', (e: google.maps.MouseEvent) => {
        const latLng = e.latLng;
        const closest = findClosestFix(this.tracks, latLng.lat(), latLng.lng());
        if (closest) {
          dispatch(act.setTimestamp(closest.ts));
          dispatch(act.setCurrentTrack(closest.track));
        }
      });

      this.subscriptions.push(
        msg.centerMap.subscribe(({ lat, lon }) => this.center(lat, lon)),
        msg.centerZoomMap.subscribe(({ lat, lon }, delta) => {
          this.center(lat, lon);
          this.zoom(delta);
        }),
        msg.tracksAdded.subscribe(() => this.fitTracks()),
        msg.tracksRemoved.subscribe(() => this.fitTracks()),
        msg.requestLocation.subscribe(() => this.updateLocation()),
        msg.geoLocation.subscribe((latLon) => this.geolocation(latLon)),
      );

      const location = store.getState().map.location;

      if (this.tracks.length) {
        // Zoom to tracks when there are some.
        this.fitTracks();
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
        this.map.setCenter({ lat: latLon.lat, lng: latLon.lon });
        this.map.setZoom(zoom);
      }

      dispatch(act.setApiLoading(false));
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
    this.map = undefined;
  }

  createRenderRoot(): Element {
    return this;
  }

  protected render(): TemplateResult {
    return html`
      <div id="map"></div>
      <topo-eu .map=${this.map}></topo-eu>
      <topo-spain .map=${this.map}></topo-spain>
      <topo-france .map=${this.map}></topo-france>
      <topo-otm .map=${this.map}></topo-otm>
      <segments-element .map=${this.map} .query=${document.location.search}></task-element>
      ${this.tracks.map(
        (track, i) =>
          html`
            <marker-element
              .map=${this.map}
              .track=${track}
              .timestamp=${this.timestamp}
              .index=${i}
              .active=${i == this.currentTrackIndex}
            ></marker-element>
            <line-element
              .map=${this.map}
              .track=${track}
              .index=${i}
              .active=${i == this.currentTrackIndex}
            ></line-element>
          `,
      )}
    `;
  }

  // Center the map on the user location if they have not yet interacted with the map.
  private geolocation({ lat, lon }: LatLon): void {
    if (this.map) {
      const center = this.map.getCenter();
      const start = store.getState().map.location.start;
      if (center.lat() == start.lat && center.lng() == start.lon) {
        this.center(lat, lon);
      }
    }
  }

  private center(lat: number, lon: number): void {
    this.map?.setCenter({ lat, lng: lon });
  }

  private zoom(delta: number): void {
    const map = this.map as google.maps.Map;
    map.setZoom(map.getZoom() + (delta < 0 ? 1 : -1));
  }

  private fitTracks(): void {
    const extent = sel.tracksExtent(store.getState().map);
    if (extent != null) {
      const bounds = new google.maps.LatLngBounds(
        { lat: extent.sw.lat, lng: extent.sw.lon },
        { lat: extent.ne.lat, lng: extent.ne.lon },
      );
      this.map?.fitBounds(bounds);
    }
  }

  private updateLocation(): void {
    if (this.map) {
      const center = this.map.getCenter();
      dispatch(act.setCurrentLocation({ lat: center.lat(), lon: center.lng() }, this.map.getZoom()));
    }
  }
}
