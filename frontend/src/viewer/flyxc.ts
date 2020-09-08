import '@ui5/webcomponents/dist/Button';
import '@ui5/webcomponents/dist/Dialog';
import '@ui5/webcomponents/dist/Icon';
import '@ui5/webcomponents/dist/Input';
import '@ui5/webcomponents/dist/Label';
import '@ui5/webcomponents/dist/Option';
import '@ui5/webcomponents/dist/Select';
import '@ui5/webcomponents/dist/Toast';
import '@ui5/webcomponents/dist/Assets.js';

import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LatLon, RuntimeTrack } from '../../../common/track';
import * as act from './actions';
import { MapElement } from './components/2d/map-element';
import { Map3dElement } from './components/3d/map3d-element';
import { ChartElement } from './components/chart-element';
import { LoaderElement } from './components/loader-element';
import {
  addUrlParamValues,
  deleteUrlParam,
  getUrlParam,
  has3dUrlParam,
  ParamNames,
  pushCurrentState,
} from './logic/history';
import * as msg from './logic/messages';
import { downloadTracksById, downloadTracksByUrl, uploadTracks } from './logic/tracks';
import * as sel from './selectors';
import { dispatch, RootState, store } from './store';

export { MapElement, LoaderElement, ChartElement, Map3dElement };

@customElement('fly-xc')
export class FlyXc extends connect(store)(LitElement) {
  @internalProperty()
  private tracks: RuntimeTrack[] = [];

  @internalProperty()
  private view3d = false;

  @internalProperty()
  private showLoader = false;

  constructor() {
    super();
    // Add or remove tracks when the url changes.
    window.addEventListener('popstate', () => this.handlePopState());
    // Allow dropping tracks on flyxc.
    document.body.ondrop = async (e: DragEvent): Promise<void> => await this.handleDrop(e);
    document.body.ondragover = (e: DragEvent): void => e.preventDefault();

    // Download tracks
    Promise.all([
      downloadTracksById(getUrlParam(ParamNames.TRACK_ID)),
      downloadTracksByUrl(getUrlParam(ParamNames.TRACK_URL)),
    ]).then(([ids1, ids2]) => {
      // Update the url to use ids only.
      deleteUrlParam(ParamNames.TRACK_URL);
      addUrlParamValues(ParamNames.TRACK_ID, [...ids1, ...ids2]);
    });
  }

  stateChanged(state: RootState): void {
    this.tracks = sel.tracks(state.map);
    this.view3d = state.map.view3d;
    this.showLoader = state.map.loadingTracks || state.map.loadingApi;
  }

  protected render(): TemplateResult {
    const hasTracks = this.tracks.length > 0 ? 'has-tracks' : '';

    return html`
      ${this.view3d
        ? html`<map3d-element class=${hasTracks}></map3d-element>`
        : html`<map-element class=${hasTracks}></map-element>`}
      ${this.tracks.length
        ? html`<chart-element
            class=${hasTracks}
            @move=${(e: CustomEvent) => dispatch(act.setTimestamp(e.detail.ts))}
            @pin=${(e: CustomEvent) => msg.centerMap.emit(this.coordinatesAt(e.detail.ts))}
            @zoom=${(e: CustomEvent) => msg.centerZoomMap.emit(this.coordinatesAt(e.detail.ts), e.detail.event.deltaY)}
          ></chart-element>`
        : ''}
      <loader-element .show=${this.showLoader}></loader-element>
    `;
  }

  createRenderRoot(): Element {
    return this;
  }

  // Returns the coordinates of the active track at the given timestamp.
  private coordinatesAt(ts: number): LatLon {
    return sel.getTrackLatLon(store.getState().map)(ts) as LatLon;
  }

  private handlePopState(): void {
    const currentIds = getUrlParam(ParamNames.TRACK_ID).map((txt) => Number(txt));
    const previousIds = sel.trackIds(store.getState().map);
    // Close all the tracks that have been removed from the previous state.
    const removedTracks: number[] = [];
    previousIds.forEach((id) => {
      if (currentIds.indexOf(id) < 0) {
        removedTracks.push(id);
      }
    });
    if (removedTracks.length) {
      dispatch(act.removeTracksById(removedTracks));
      msg.tracksRemoved.emit(removedTracks);
    }
    // Load all the tracks that have been added in the current state.
    downloadTracksById(currentIds.filter((id) => previousIds.indexOf(id) == -1));
    dispatch(act.setView3d(has3dUrlParam()));
  }

  // Load tracks dropped on the map.
  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    let files: File[] = [];
    if (e.dataTransfer) {
      if (e.dataTransfer.items) {
        files = [...e.dataTransfer.items].map((e) => e.getAsFile()).filter((e) => e != null) as File[];
      } else if (e.dataTransfer.files) {
        files = [...e.dataTransfer.files];
      }
    }
    if (files.length) {
      const ids = await uploadTracks(files);
      pushCurrentState();
      addUrlParamValues(ParamNames.TRACK_ID, ids);
    }
  }
}

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition((p: Position) => {
    const { latitude: lat, longitude: lon } = p.coords;
    msg.geoLocation.emit({ lat, lon });
    dispatch(act.setGeoloc({ lat, lon }));
  });
}
