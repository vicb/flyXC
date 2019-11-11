import * as mapSel from '../selectors/map';

import { CSSResult, LitElement, PropertyValues, TemplateResult, css, customElement, html, property } from 'lit-element';
import { RootState, store } from '../store';
import { TopoEu, TopoFrance, TopoOtm, TopoSpain } from './topo-elements';
import { Track, downloadTracks, downloadTracksFromHistory, findClosestFix, uploadTracks } from '../logic/map';
import { setCurrentTrack, setMap, setTs } from '../actions/map';

import { ChartElement } from './chart-element';
import { ControlsElement } from './controls-element';
import { GmLineElement } from './gm-line';
import { GmMarkerElement } from './gm-marker';
import { PlannerElement } from './planner-element';
import { TaskElement } from './task-element';
import { TrackingElement } from './tracking-element';
import { connect } from 'pwa-helpers';
import { getApiKey } from '../../keys';
import { sampleAt } from '../logic/math';

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
  tracks: Track[] | null = null;

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
      const shadowRoot = this.shadowRoot as ShadowRoot;
      const map = (this.map = new google.maps.Map(shadowRoot.querySelector('#map'), {
        center: { lat: 45, lng: 0 },
        zoom: 5,
        minZoom: 5,
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
        if (this.shadowRoot) {
          if (e.detail) {
            this.shadowRoot.host.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
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
        navigator.geolocation.getCurrentPosition((p: any) => {
          map.setCenter(new google.maps.LatLng(p.coords.latitude, p.coords.longitude));
          map.setZoom(12);
        });
      }
      downloadTracks(searchParams.getAll('track'));
      downloadTracksFromHistory(searchParams.getAll('h'));
    });
  }

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
        }
        #map {
          width: 100%;
          height: 100%;
        }
        chart-element {
          width: 100%;
          height: 0%;
        }
        :host(.hasTracks) #map {
          height: 80%;
        }
        :host(.hasTracks) chart-element {
          height: 20%;
        }
        .attribution {
          margin: 2px 5px;
          color: black;
          text-decoration: none;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <div id="map"></div>
      ${this.tracks?.length
        ? html`
            <chart-element @move=${this.setTs} @pin=${this.centerMap} @zoom=${this.zoomMap}></chart-element>
          `
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
          `,
      )}
      ${this.tracks?.map(
        (track, i) =>
          html`
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
    // Load google maps
    const loader = document.createElement('script');
    loader.src = `https://maps.googleapis.com/maps/api/js?key=${getApiKey(
      'gmaps',
    )}&libraries=geometry&callback=initMap`;
    const shadowRoot = this.shadowRoot as ShadowRoot;
    shadowRoot.appendChild(loader);
  }
}
