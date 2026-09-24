import './styles.css';
// https://ionicframework.com/docs/intro/cdn
import '@ionic/core/css/core.css';
import '@ionic/core/css/normalize.css';
import '@ionic/core/css/padding.css';
import '@ionic/core/css/structure.css';
import '@ionic/core/css/text-alignment.css';
import '@ionic/core/css/typography.css';
import './app/components/loader-element';
import './app/components/pwa-install';
import './app/components/ui/main-menu';

import type { Class, LatLonAlt, Type } from '@flyxc/common';
import type { NavigationHookCallback } from '@ionic/core';
import type { PropertyValues, TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';
import { registerSW } from 'virtual:pwa-register';

import type { ChartTrack } from './app/components/chart-element';
import { ChartYAxis } from './app/components/chart-element';
import type { PWAInstallComponent } from './app/components/pwa-install';
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
import { handleServiceWorkerReload } from './app/logic/pwa-lifecycle';
import { downloadTracksByGroupIds, downloadTracksByUrls, uploadTracks } from './app/logic/track';
import type * as units from './app/logic/units';
import * as airspaces from './app/redux/airspace-slice';
import * as app from './app/redux/app-slice';
import * as liveTrack from './app/redux/live-track-slice';
import * as planner from './app/redux/planner-slice';
import * as sel from './app/redux/selectors';
import type { RootState } from './app/redux/store';
import { store } from './app/redux/store';
import * as track from './app/redux/track-slice';
import * as unitsSlice from './app/redux/units-slice';

type NavigationHookResult = Awaited<ReturnType<NavigationHookCallback>>;

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
  @query('pwa-install')
  private pwaInstallComponent?: PWAInstallComponent;

  private showPwaInstall = false;

  stateChanged(): void {
    // TODO(vicb): install screen is confusing
    // this.showPwaInstall = !state.app.pwaInstallCancelled && !state.browser.isInIframe;
  }

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
      ${when(
        this.showPwaInstall,
        () => html`<pwa-install
          manifestpath="/manifest.webmanifest"
          iconpath="/static/iconx/pwa-maskable-192x192.png"
          explainer="flyXC can be installed on your PC or mobile. This will allow this web app to look and behave like any other installed app. You will benefit from a richer and faster experience."
          .features=${[
            'Visualize multiple tracks',
            '2D and 3D views',
            'Plan your routes',
            'Aggregate your live tracking positions from the major platforms',
          ]}
          .deferredprompt=${window.deferredPrompt}
          @hide=${this.cancelInstall}
        ></pwa-install>`,
      )}
    `;
  }

  private cancelInstall(): void {
    store.dispatch(app.setPwaInstallCancelled(true));
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

  protected firstUpdated(props: PropertyValues): void {
    super.firstUpdated(props);

    if (this.pwaInstallComponent?.getInstalledStatus() === false) {
      this.pwaInstallComponent?.openPrompt();
    }
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
    store.dispatch(planner.setSpeedKmh(planner.parseSpeedParam(getUrlParamValues(ParamNames.speed)[0])));
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

  @state()
  private chartTracks: ChartTrack[] = [];

  @state()
  private chartActiveTrackId?: string;

  @state()
  private chartYAxis: ChartYAxis = ChartYAxis.Altitude;

  @state()
  private availableYAxes: ChartYAxis[] = [];

  @state()
  private timeSec = 0;

  @state()
  private minTimeSec = 0;

  @state()
  private maxTimeSec = 1;

  @state()
  private minY = 0;

  @state()
  private maxY = 1;

  @state()
  private units?: units.Units;

  @state()
  private showClasses: Class[] = [];

  @state()
  private showTypes: Type[] = [];

  @state()
  private isLiveTrack = false;

  private lastSelectedLiveId?: string;
  private lastSelectedTrackId?: string;

  /**
   * Responds to Redux state updates, synchronizing chart properties, airspace settings,
   * and clamping/adjusting current time when tracks or live tracks are selected or switched.
   *
   * @param state - The root application state.
   */
  stateChanged(state: RootState): void {
    const selectedLive = sel.activeLiveTrack(state);
    const hasLiveTrack = selectedLive != null;
    this.isLiveTrack = hasLiveTrack;
    this.hasTrack = sel.hasChartTrack(state);
    this.showLoader = track.selectFetching(state) || app.selectLoadingApi(state);

    this.chartTracks = sel.chartTracks(state);
    this.chartActiveTrackId = sel.chartActiveTrackId(state);
    this.chartYAxis = hasLiveTrack ? ChartYAxis.Altitude : app.selectChartYAxis(state);
    this.availableYAxes = sel.chartAvailableYAxes(state);
    this.timeSec = app.selectTimeSec(state);
    this.minTimeSec = sel.chartMinTimeSec(state);
    this.maxTimeSec = sel.chartMaxTimeSec(state);
    this.minY = sel.chartMinY(state);
    this.maxY = sel.chartMaxY(state);
    this.units = unitsSlice.selectUnits(state);
    this.showClasses = airspaces.selectShowClasses(state);
    this.showTypes = airspaces.selectShowTypes(state);

    // If a live track is selected, ensure timeSec is within its range.
    const currentLiveId = liveTrack.selectCurrentLiveId(state);
    const liveIdChanged = currentLiveId !== this.lastSelectedLiveId;
    this.lastSelectedLiveId = currentLiveId;

    if (currentLiveId && selectedLive && selectedLive.timeSec.length > 0) {
      if (liveIdChanged) {
        const lastFixTime = selectedLive.timeSec.at(-1);
        if (
          lastFixTime != null &&
          (this.timeSec < this.minTimeSec || this.timeSec > this.maxTimeSec) &&
          lastFixTime !== this.timeSec
        ) {
          store.dispatch(app.setTimeSec(lastFixTime));
        }
      } else if (this.timeSec < this.minTimeSec) {
        store.dispatch(app.setTimeSec(this.minTimeSec));
      } else if (this.timeSec > this.maxTimeSec) {
        store.dispatch(app.setTimeSec(this.maxTimeSec));
      }
    }

    // Handle runtime tracks selection / switching.
    const currentTrackId = track.selectCurrentTrackId(state);
    const prevTrackId = this.lastSelectedTrackId;
    const trackIdChanged = currentTrackId !== prevTrackId;
    this.lastSelectedTrackId = currentTrackId;

    const trackIds = track.selectTrackIds(state);
    if (!hasLiveTrack && trackIds.length > 0) {
      if (trackIdChanged) {
        const isMultiDay = sel.isMultiDay(state);
        const trackEntities = track.selectTrackEntities(state);
        const prevTrack = prevTrackId ? trackEntities[prevTrackId] : undefined;
        const currentTrack = currentTrackId ? trackEntities[currentTrackId] : undefined;

        if (isMultiDay && prevTrack && currentTrack) {
          // If the caller has already set the timestamp within the selected track's range
          // (e.g. clicking directly on the track fix on the map), do not add the track-start delta.
          const minTime = currentTrack.minTimeSec ?? currentTrack.timeSec[0];
          const maxTime = currentTrack.maxTimeSec ?? currentTrack.timeSec.at(-1) ?? minTime;
          const isTimePreSet = this.timeSec >= minTime && this.timeSec <= maxTime;
          const delta = isTimePreSet ? 0 : currentTrack.timeSec[0] - prevTrack.timeSec[0];
          const targetTimeSec = Math.max(this.minTimeSec, Math.min(this.maxTimeSec, this.timeSec + delta));
          if (targetTimeSec !== this.timeSec) {
            store.dispatch(app.setTimeSec(targetTimeSec));
          }
        } else if (this.timeSec < this.minTimeSec || this.timeSec > this.maxTimeSec) {
          const targetTimeSec = currentTrack?.timeSec[0] ?? this.minTimeSec;
          if (targetTimeSec !== this.timeSec) {
            store.dispatch(app.setTimeSec(targetTimeSec));
          }
        }
      } else if (this.timeSec < this.minTimeSec || this.timeSec > this.maxTimeSec) {
        if (this.minTimeSec !== this.timeSec) {
          store.dispatch(app.setTimeSec(this.minTimeSec));
        }
      }
    }
  }

  render(): TemplateResult {
    const clMap = classMap({ 'has-tracks': this.hasTrack });

    return html` <ion-split-pane content-id="main" when=${SHOW_SPLIT_PANE_WHEN}>
        <main-menu></main-menu>
        <ion-content id="main" @click=${this.contentClicked}>
          <ion-router-outlet class=${clMap}></ion-router-outlet>
          ${when(
            this.hasTrack,
            () => html`<chart-element
              class=${clMap}
              .tracks=${this.chartTracks}
              .currentTrackId=${this.chartActiveTrackId}
              .chartYAxis=${this.chartYAxis}
              .availableYAxes=${this.availableYAxes}
              .timeSec=${this.timeSec}
              .minTimeSec=${this.minTimeSec}
              .maxTimeSec=${this.maxTimeSec}
              .minY=${this.minY}
              .maxY=${this.maxY}
              .units=${this.units}
              .showClasses=${this.showClasses}
              .showTypes=${this.showTypes}
              .isLiveTrack=${this.isLiveTrack}
              @move=${(e: CustomEvent) => store.dispatch(app.setTimeSec(e.detail.timeSec))}
              @pin=${(e: CustomEvent) => msg.centerMap.emit(this.coordinatesAt(e.detail.timeSec))}
              @zoom=${(e: CustomEvent) => msg.centerZoomMap.emit(this.coordinatesAt(e.detail.timeSec), e.detail.deltaY)}
              @select-y=${(e: CustomEvent) => store.dispatch(app.setChartYAxis(e.detail.y))}
            ></chart-element>`,
          )}
        </ion-content>
      </ion-split-pane>
      <loader-element .show=${this.showLoader}></loader-element>`;
  }

  private contentClicked() {
    maybeHideSidePane();
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

// Register the service worker with automatic updates without user prompt,
// while handling reloads safely to prevent redundant reloads and infinite loops.
registerSW({
  immediate: true,
  async onNeedReload() {
    await handleServiceWorkerReload();
  },
  onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) {
      return;
    }
    setInterval(
      async () => await updateServiceWorker(swUrl, registration),
      PWA_UPDATE_INTERVAL_DAYS * 24 * 3600 * 1000,
    );
  },
  onRegisterError(error) {
    console.error(error);
  },
});

// Also listen for SW activation broadcasts to catch background updates seamlessly.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_ACTIVATED') {
      handleServiceWorkerReload({ swVersion: event.data.version });
    }
  });
}

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
