import './styles.css';
// https://ionicframework.com/docs/intro/cdn
import '@ionic/core/css/core.css';
import '@ionic/core/css/normalize.css';
import '@ionic/core/css/padding.css';
import '@ionic/core/css/structure.css';
import '@ionic/core/css/text-alignment.css';
import '@ionic/core/css/typography.css';
import './app/components/chart-element';
import './app/components/loader-element';
import './app/components/ui/main-menu';

import type { LatLonAlt } from '@flyxc/common';
import type { NavigationHookResult } from '@ionic/core/dist/types/components/route/route-interface';
import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';
import { registerSW } from 'virtual:pwa-register';

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
import * as app from './app/redux/app-slice';
import * as liveTrack from './app/redux/live-track-slice';
import * as planner from './app/redux/planner-slice';
import * as sel from './app/redux/selectors';
import type { RootState } from './app/redux/store';
import { store } from './app/redux/store';
import * as track from './app/redux/track-slice';

export const SHOW_SPLIT_PANE_WHEN = `(min-width: 992px)`;

const PWA_UPDATE_INTERVAL_DAYS = 2;

/* Hides the side plane on small screens */
export async function maybeHideSidePane() {
  const splitPane = document.querySelector('ion-split-pane');
  if (splitPane && (await splitPane.isVisible()) !== false) {
    splitPane.when = SHOW_SPLIT_PANE_WHEN;
  }
}
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
    Promise.allSettled([
      downloadTracksByGroupIds(getUrlParamValues(ParamNames.groupId)),
      downloadTracksByUrls(getUrlParamValues(ParamNames.trackUrl)),
    ]).then(() => {
      store.dispatch(track.setTrackLoaded(true));
      const numTracks = sel.numTracks(store.getState());
      store.dispatch(track.setDisplayLabels(numTracks > 1));
      store.dispatch(liveTrack.setDisplayLabels(numTracks === 0));
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
            component="settings-page"
            .beforeEnter=${this.beforeDevices}
            .componentProps=${{ accountId: null }}
          ></ion-route>
          <ion-route
            url="/privacy-policy"
            component="privacy-policy-page"
            .beforeEnter=${this.beforePrivacyPolicy}
          ></ion-route>
          <ion-route url="/terms" component="terms-page" .beforeEnter=${this.beforeTermsConditions}></ion-route>
          <ion-route url="/adm" component="admin-page" .beforeEnter=${this.beforeAdmin}></ion-route>
          <ion-route
            url="/adm/account/:accountId"
            component="settings-page"
            .beforeEnter=${this.beforeDevices}
          ></ion-route>
          <ion-route url="/arc" component="archives-page" .beforeEnter=${this.beforeArchives}></ion-route>
          <ion-route url="*" .beforeEnter=${() => ({ redirect: '/' })} component="x-301"></ion-route>
        </ion-router>
        <ion-router-outlet .animated=${false}></ion-router-outlet>
      </ion-app>
    `;
  }

  private async beforeAdmin(): Promise<NavigationHookResult> {
    await import('./app/pages/admin');
    return true;
  }

  private async beforeArchives(): Promise<NavigationHookResult> {
    await import('./app/pages/archives');
    return true;
  }

  private async beforeDevices(): Promise<NavigationHookResult> {
    await import('./app/pages/settings');
    return true;
  }

  private async beforePrivacyPolicy(): Promise<NavigationHookResult> {
    await import('./app/pages/privacy-policy');
    return true;
  }

  private async beforeTermsConditions(): Promise<NavigationHookResult> {
    await import('./app/pages/terms');
    return true;
  }

  private async before2d(): Promise<NavigationHookResult> {
    const params = getSearchParams();
    if (params.has(ParamNames.view3d)) {
      params.delete(ParamNames.view3d);
      return { redirect: `/3d?${params.toString()}` };
    }
    await import('./app/components/2d/map-element');
    store.dispatch(app.setView3d(false));
    return true;
  }

  private async before3d(): Promise<NavigationHookResult> {
    await import('./app/components/3d/map3d-element');
    store.dispatch(app.setView3d(true));
    return true;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private handlePopState(): void {
    // Handle added and removed tracks.
    const nextGroupIds = new Set(getUrlParamValues(ParamNames.groupId).map((txt) => Number(txt)));
    const currentGroupIds = sel.groupIds(store.getState());
    // Close all the tracks that have been removed.
    const removedTrackGroups = [...currentGroupIds].filter((id) => !nextGroupIds.has(id));
    if (removedTrackGroups.length) {
      store.dispatch(track.removeTracksByGroupIds(removedTrackGroups));
      app.updateAppTime(store);
      msg.trackGroupsRemoved.emit(removedTrackGroups);
    }
    // Load all the tracks that have been added.
    downloadTracksByGroupIds([...nextGroupIds].filter((id) => !currentGroupIds.has(id)));
    store.dispatch(app.setView3d(getCurrentUrl().pathname == '/3d'));

    // Update the route and speed.
    store.dispatch(planner.setRoute(getUrlParamValues(ParamNames.route)[0] ?? ''));
    store.dispatch(planner.setSpeedKmh(Number(getUrlParamValues(ParamNames.speed)[0] ?? 20)));
  }

  // Load tracks dropped on the map.
  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const files: Array<File | null> = [];
    if (e.dataTransfer?.items) {
      files.concat(Array.from(e.dataTransfer.items).map((i) => i.getAsFile()));
    } else if (e.dataTransfer?.files) {
      files.concat(Array.from(e.dataTransfer.files));
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

    return html` <ion-split-pane content-id="main" when=${SHOW_SPLIT_PANE_WHEN}>
        <main-menu></main-menu>
        <ion-content id="main">
          <ion-router-outlet class=${clMap}></ion-router-outlet>
          ${when(
            this.hasTrack,
            () => html`<chart-element
              class=${clMap}
              @move=${(e: CustomEvent) => store.dispatch(app.setTimeSec(e.detail.timeSec))}
              @pin=${(e: CustomEvent) => msg.centerMap.emit(this.coordinatesAt(e.detail.timeSec))}
              @zoom=${(e: CustomEvent) => msg.centerZoomMap.emit(this.coordinatesAt(e.detail.timeSec), e.detail.deltaY)}
            ></chart-element>`,
          )}
        </ion-content>
      </ion-split-pane>
      <loader-element .show=${this.showLoader}></loader-element>`;
  }

  // Returns the coordinates of the active track at the given timestamp.
  private coordinatesAt(timeSec: number): LatLonAlt {
    return sel.getTrackLatLonAlt(store.getState())(timeSec) as LatLonAlt;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

requestCurrentPosition(false);

ionicInit();

registerSW({
  immediate: true,
  onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) {
      return;
    }
    setInterval(
      async () => await updateServiceWorker(swUrl, registration),
      PWA_UPDATE_INTERVAL_DAYS * 24 * 3600 * 1000,
    );
  },
});

async function updateServiceWorker(swUrl: string, registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.installing || !navigator) {
    return;
  }

  if ('connection' in navigator && !navigator.onLine) {
    return;
  }

  try {
    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        cache: 'no-store',
        'cache-control': 'no-cache',
      },
    });

    if (resp?.status === 200) {
      await registration.update();
    }
  } catch (e) {
    console.error('Failed to update service worker.', e);
  }
}
