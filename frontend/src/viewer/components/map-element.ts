import '@ui5/webcomponents/dist/Assets.js';

import cookies from 'cookiesjs';
import { customElement, html, LitElement, property, PropertyValues, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { findClosestFix } from '../../../../common/distance';
import { RuntimeTrack } from '../../../../common/track';
import { getApiKey } from '../../apikey';
import { setCurrentTrack, setMap, setTs } from '../actions/map';
import { downloadTracks, downloadTracksFromHistory, uploadTracks } from '../logic/map';
import { sampleAt } from '../logic/math';
import * as mapSel from '../selectors/map';
import { RootState, store } from '../store';
import { ChartElement } from './chart-element';
import { ControlsElement } from './controls-element';
import { GmLineElement } from './gm-line';
import { GmMarkerElement } from './gm-marker';
import { PlannerElement } from './planner-element';
import { TaskElement } from './task-element';
import { TopoEu, TopoFrance, TopoOtm, TopoSpain } from './topo-elements';
import { TrackingElement } from './tracking-element';

// Prevent tree-shaking components by exporting them
export {
  ChartElement,
  ControlsElement,
  GmLineElement,
  GmMarkerElement,
  PlannerElement,
  TaskElement,
  TopoEu,
  TopoSpain,
  TopoFrance,
  TopoOtm,
  TrackingElement,
};

declare global {
  interface Window {
    initMap: () => void;
  }
}

window.initMap = (): boolean => window.dispatchEvent(new CustomEvent('google-map-ready'));

@customElement('map-element')
export class MapElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  tracks: RuntimeTrack[] | null = null;

  @property({ attribute: false })
  timestamp = 0;

  @property({ attribute: false })
  aspAltitude = 1;

  @property({ attribute: false })
  map: google.maps.Map | null = null;

  @property({ attribute: false })
  currentTrack = 0;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.tracks = mapSel.tracks(state.map);
      this.timestamp = state.map.ts;
      this.aspAltitude = state.map.aspAltitude;
      this.map = state.map.map;
      this.currentTrack = state.map.currentTrack;
    }
  }

  constructor() {
    super();
    window.addEventListener('google-map-ready', () => {
      const map = (this.map = new google.maps.Map(this.querySelector('#map') as Element, {
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
      }));
      store.dispatch(setMap(map));

      const ctrlsEl = document.createElement('controls-element');
      ctrlsEl.addEventListener('fullscreen' as any, (e: CustomEvent): void => {
        if (e.detail) {
          this.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
      this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(ctrlsEl);

      this.map.addListener('click', (e: google.maps.MouseEvent) => {
        const latLng = e.latLng;
        const closest = findClosestFix(store.getState().map.tracks, latLng.lat(), latLng.lng());
        if (closest) {
          store.dispatch(setTs(closest.ts));
          store.dispatch(setCurrentTrack(closest.track));
        }
      });

      document.body.ondrop = (e: DragEvent): void => this.handleDrop(e);
      document.body.ondragover = (e: DragEvent): void => e.preventDefault();

      const qs = new URL(document.location.href).search.substr(1);
      const searchParams = new URLSearchParams(qs);
      if (
        !searchParams.has('track') &&
        !searchParams.has('h') &&
        !searchParams.has('p') &&
        'geolocation' in navigator
      ) {
        const last_coordinates = cookies('coordinates');
        if (last_coordinates) {
          map.setCenter(new google.maps.LatLng(last_coordinates.latitude, last_coordinates.longitude));
          map.setZoom(12);
        }
        let hasMoved = false;
        google.maps.event.addListenerOnce(map, 'drag', () => (hasMoved = true));
        navigator.geolocation.getCurrentPosition((p: Position) => {
          if (!hasMoved) {
            // Ignore the GPS position when the user has already started to move the map around.
            map.setCenter(new google.maps.LatLng(p.coords.latitude, p.coords.longitude));
            map.setZoom(12);
          }
          const { latitude, longitude } = p.coords;
          cookies({ coordinates: { latitude, longitude } });
        });
      }
      downloadTracks(searchParams.getAll('track'));
      downloadTracksFromHistory(searchParams.getAll('h'));
    });
  }

  createRenderRoot(): Element {
    return this;
  }

  render(): TemplateResult {
    return html`
      <div id="map"></div>
      ${this.tracks?.length
        ? html` <chart-element @move=${this.setTs} @pin=${this.centerMap} @zoom=${this.zoomMap}></chart-element> `
        : ''}
      <topo-eu .map=${this.map}></topo-eu>
      <topo-spain .map=${this.map}></topo-spain>
      <topo-france .map=${this.map}></topo-france>
      <topo-otm .map=${this.map}></topo-otm>
      <task-element .map=${this.map} .query=${document.location.search.substr(1)}></task-element>
      ${this.tracks?.map(
        (track, i) =>
          html`
            <gm-marker
              .map=${this.map}
              .track=${track}
              .timestamp=${this.timestamp}
              .index=${i}
              .active=${i == this.currentTrack}
            ></gm-marker>
            <gm-line .map=${this.map} .track=${track} .index=${i} .active=${i == this.currentTrack}></gm-line>
          `,
      )}
    `;
  }

  protected handleDrop(e: DragEvent): void {
    e.preventDefault();

    if (e.dataTransfer) {
      if (e.dataTransfer.items) {
        const items = e.dataTransfer.items;
        const files = [];
        for (let i = 0; i < items.length; i++) {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
        uploadTracks(files);
      } else if (e.dataTransfer.files) {
        const files: File[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          files.push(e.dataTransfer.files[i]);
        }
        uploadTracks(files);
      }
    }
  }

  protected setTs(e: CustomEvent): void {
    store.dispatch(setTs(e.detail.ts));
  }

  protected centerMap(e: CustomEvent): void {
    const state = store.getState().map;
    const fixes = state.tracks[state.currentTrack].fixes;
    const lat = sampleAt(fixes.ts, fixes.lat, [e.detail.ts])[0];
    const lng = sampleAt(fixes.ts, fixes.lon, [e.detail.ts])[0];
    (this.map as google.maps.Map).setCenter({ lat, lng });
  }

  protected zoomMap(e: CustomEvent): void {
    const map = this.map as google.maps.Map;
    this.centerMap(e);
    map.setZoom(map.getZoom() + (e.detail.event.deltaY < 0 ? 1 : -1));
  }

  firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);
    // Track url
    const qs = new URL(document.location.href).search.substr(1);
    const searchParams = new URLSearchParams(qs);
    // Load google maps
    const loader = document.createElement('script');
    loader.src = `https://maps.googleapis.com/maps/api/js?key=${getApiKey(
      'gmaps',
      searchParams.get('track'),
    )}&libraries=geometry&callback=initMap`;
    this.appendChild(loader);
  }
}
