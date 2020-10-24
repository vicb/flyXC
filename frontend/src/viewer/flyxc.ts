import '@ui5/webcomponents/dist/Button';
import '@ui5/webcomponents/dist/Dialog';
import '@ui5/webcomponents/dist/Icon';
import '@ui5/webcomponents/dist/Input';
import '@ui5/webcomponents/dist/Label';
import '@ui5/webcomponents/dist/Option';
import '@ui5/webcomponents/dist/Select';
import '@ui5/webcomponents/dist/Toast';
import '@ui5/webcomponents/dist/Assets.js';
import './styles/main.css';

import { LatLonZ } from 'flyxc/common/src/track';
import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map.js';
import { connect } from 'pwa-helpers';

import { MapElement } from './components/2d/map-element';
import { Map3dElement } from './components/3d/map3d-element';
import { ChartElement } from './components/chart-element';
import { LoaderElement } from './components/loader-element';
import {
  addUrlParamValues,
  deleteUrlParam,
  getSearchParams,
  getUrlParamValues,
  ParamNames,
  pushCurrentState,
} from './logic/history';
import * as msg from './logic/messages';
import { downloadTracksByGroupIds, downloadTracksByUrls, uploadTracks } from './logic/tracks';
import { setDisplayNames, setTimestamp, setView3d } from './redux/app-slice';
import { setGeolocation } from './redux/location-slice';
import { setRoute, setSpeed } from './redux/planner-slice';
import * as sel from './redux/selectors';
import { RootState, store } from './redux/store';
import { removeTracksByGroupIds } from './redux/track-slice';

export { MapElement, LoaderElement, ChartElement, Map3dElement };

@customElement('fly-xc')
export class FlyXc extends connect(store)(LitElement) {
  @internalProperty()
  private hasTrack = false;

  @internalProperty()
  private view3d = false;

  @internalProperty()
  private showLoader = false;

  constructor() {
    super();
    // Add or remove tracks when the url changes.
    window.addEventListener('popstate', () => this.handlePopState());
    // Handle dropping tracks.
    document.body.ondrop = async (e: DragEvent): Promise<void> => await this.handleDrop(e);
    document.body.ondragover = (e: DragEvent): void => e.preventDefault();

    // Download initial tracks.
    Promise.all([
      downloadTracksByGroupIds(getUrlParamValues(ParamNames.groupId)),
      downloadTracksByUrls(getUrlParamValues(ParamNames.trackUrl)),
    ]).then(() => {
      store.dispatch(setDisplayNames(sel.numTracks(store.getState()) > 1));
      // Remove the track urls as they will be replaced with ids.
      deleteUrlParam(ParamNames.trackUrl);
    });
  }

  stateChanged(state: RootState): void {
    this.hasTrack = sel.numTracks(state) > 0;
    this.view3d = state.app.view3d;
    this.showLoader = state.track.fetching || state.app.loadingApi;
  }

  protected render(): TemplateResult {
    const clMap = classMap({ 'has-tracks': this.hasTrack });
    return html`
      ${this.view3d
        ? html`<map3d-element class=${clMap}></map3d-element>`
        : html`<map-element class=${clMap}></map-element>`}
      ${this.hasTrack
        ? html`<chart-element
            class=${clMap}
            @move=${(e: CustomEvent) => store.dispatch(setTimestamp(e.detail.ts))}
            @pin=${(e: CustomEvent) => msg.centerMap.emit(this.coordinatesAt(e.detail.ts))}
            @zoom=${(e: CustomEvent) => msg.centerZoomMap.emit(this.coordinatesAt(e.detail.ts), e.detail.deltaY)}
          ></chart-element>`
        : ''}
      <loader-element .show=${this.showLoader}></loader-element>
    `;
  }

  createRenderRoot(): Element {
    return this;
  }

  // Returns the coordinates of the active track at the given timestamp.
  private coordinatesAt(ts: number): LatLonZ {
    return sel.getTrackLatLonAlt(store.getState())(ts) as LatLonZ;
  }

  private handlePopState(): void {
    // Handle added and removed tracks.
    const nextGroupIds = new Set(getUrlParamValues(ParamNames.groupId).map((txt) => Number(txt)));
    const currentGroupIds = sel.groupIds(store.getState());
    // Close all the tracks that have been removed.
    const removedTrackGroups = [...currentGroupIds].filter((id) => !nextGroupIds.has(id));
    if (removedTrackGroups.length) {
      store.dispatch(removeTracksByGroupIds(removedTrackGroups));
      msg.trackGroupsRemoved.emit(removedTrackGroups);
    }
    // Load all the tracks that have been added.
    downloadTracksByGroupIds([...nextGroupIds].filter((id) => !currentGroupIds.has(id)));
    store.dispatch(setView3d(getSearchParams().has(ParamNames.view3d)));

    // Update the route and speed.
    store.dispatch(setRoute(getUrlParamValues(ParamNames.route)[0] ?? ''));
    store.dispatch(setSpeed(Number(getUrlParamValues(ParamNames.speed)[0] ?? 20)));
  }

  // Load tracks dropped on the map.
  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const files: Array<File | null> = [];
    if (e.dataTransfer) {
      if (e.dataTransfer.items) {
        const items = e.dataTransfer.items;
        for (let i = 0; i < items.length; i++) {
          files.push(items[i].getAsFile());
        }
      } else if (e.dataTransfer.files) {
        const fileList = e.dataTransfer.files;
        for (let i = 0; i < fileList.length; i++) {
          files.push(fileList[i]);
        }
      }
    }
    const actualFiles = files.filter((file) => file != null) as File[];
    if (actualFiles.length) {
      const ids = await uploadTracks(actualFiles);
      pushCurrentState();
      addUrlParamValues(ParamNames.groupId, ids);
    }
  }
}

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition((p: Position) => {
    const { latitude: lat, longitude: lon } = p.coords;
    msg.geoLocation.emit({ lat, lon });
    store.dispatch(setGeolocation({ lat, lon }));
  });
}
