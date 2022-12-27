/// <reference types="@types/googlemaps" />

import './styles.css';
// https://ionicframework.com/docs/intro/cdn
import '@ionic/core/css/core.css';
import '@ionic/core/css/normalize.css';
import '@ionic/core/css/padding.css';
import '@ionic/core/css/structure.css';
import '@ionic/core/css/typography.css';

import './app/components/chart-element';
import './app/components/loader-element';
import './app/components/ui/main-menu';

import { LatLonZ } from '@flyxc/common';
import { html, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import esriConfig from '@arcgis/core/config';
import { NavigationHookResult } from '@ionic/core/dist/types/components/route/route-interface';

import { ionicInit } from './app/components/ui/ionic';
import { requestCurrentPosition } from './app/logic/geolocation';
import {
  addUrlParamValues,
  deleteUrlParam,
  getCurrentUrl,
  getSearchParams,
  getUrlParamValues,
  ParamNames,
  pushCurrentState,
} from './app/logic/history';
import * as msg from './app/logic/messages';
import { downloadTracksByGroupIds, downloadTracksByUrls, uploadTracks } from './app/logic/track';
import { setTimeSec, setView3d } from './app/redux/app-slice';
import { setRoute, setSpeed } from './app/redux/planner-slice';
import * as sel from './app/redux/selectors';
import { RootState, store } from './app/redux/store';
import { removeTracksByGroupIds, setDisplayLabels } from './app/redux/track-slice';

@customElement('fly-xc')
export class FlyXc extends connect(store)(LitElement) {
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
      store.dispatch(setDisplayLabels(sel.numTracks(store.getState()) > 1));
      // Remove the track urls as they will be replaced with ids.
      deleteUrlParam(ParamNames.trackUrl);
    });
  }

  protected render(): TemplateResult {
    return html`
      <ion-app>
        <ion-router .useHash=${false}>
          <ion-route component="maps-element">
            <ion-route url="/" component="map-element" .beforeEnter=${this.before2d}></ion-route>
            <ion-route url="/3d" component="map3d-element" .beforeEnter=${this.before3d}></ion-route>
          </ion-route>
          <ion-route
            url="/devices"
            component="devices-page"
            .beforeEnter=${this.beforeDevices}
            .componentProps=${{ accountId: null }}
          ></ion-route>
          <ion-route url="/adm" component="admin-page" .beforeEnter=${this.beforeAdmin}></ion-route>
          <ion-route
            url="/admin/account/:accountId"
            component="devices-page"
            .beforeEnter=${this.beforeDevices}
          ></ion-route>
          <ion-route url="*" .beforeEnter=${() => ({ redirect: '/' })} component="x-301"></ion-route>
        </ion-router>
        <ion-router-outlet .animated=${false}></ion-router-outlet>
      </ion-app>
    `;
  }

  private async beforeAdmin(): Promise<NavigationHookResult> {
    await import('./app/components/admin/admin-page');
    return true;
  }

  private async beforeDevices(): Promise<NavigationHookResult> {
    await import('./app/components/devices/devices-page');
    return true;
  }

  private async before2d(): Promise<NavigationHookResult> {
    const params = getSearchParams();
    if (params.has(ParamNames.view3d)) {
      params.delete(ParamNames.view3d);
      return { redirect: `/3d?${params.toString()}` };
    }
    await import('./app/components/2d/map-element');
    store.dispatch(setView3d(false));
    return true;
  }

  private async before3d(): Promise<NavigationHookResult> {
    await import('./app/components/3d/map3d-element');
    store.dispatch(setView3d(true));
    return true;
  }

  createRenderRoot(): Element {
    return this;
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
    store.dispatch(setView3d(getCurrentUrl().pathname == '/3d'));

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

@customElement('maps-element')
export class MapsElement extends connect(store)(LitElement) {
  @state()
  private hasTrack = false;

  @state()
  private showLoader = false;

  stateChanged(state: RootState): void {
    this.hasTrack = sel.numTracks(state) > 0;
    this.showLoader = state.track.fetching || state.app.loadingApi;
  }

  render(): TemplateResult {
    const clMap = classMap({ 'has-tracks': this.hasTrack });

    return html`<ion-content id="main">
        <ion-router-outlet class=${clMap}></ion-router-outlet>
        ${when(
          this.hasTrack,
          () => html`<chart-element
            class=${clMap}
            @move=${(e: CustomEvent) => store.dispatch(setTimeSec(e.detail.timeSec))}
            @pin=${(e: CustomEvent) => msg.centerMap.emit(this.coordinatesAt(e.detail.timeSec))}
            @zoom=${(e: CustomEvent) => msg.centerZoomMap.emit(this.coordinatesAt(e.detail.timeSec), e.detail.deltaY)}
          ></chart-element>`,
        )}
      </ion-content>
      <main-menu></main-menu>
      <loader-element .show=${this.showLoader}></loader-element>`;
  }

  // Returns the coordinates of the active track at the given timestamp.
  private coordinatesAt(timeSec: number): LatLonZ {
    return sel.getTrackLatLonAlt(store.getState())(timeSec) as LatLonZ;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

requestCurrentPosition(false);

ionicInit();
// Set the esri assets parent folder.
esriConfig.assetsPath = '/static';
