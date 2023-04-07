import { menuController, modalController } from '@ionic/core/components';
import { LitElement, TemplateResult, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';
import { requestCurrentPosition } from '../../logic/geolocation';
import { ParamNames, addUrlParamValues, pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { uploadTracks } from '../../logic/track';
import { DistanceUnit, formatUnit } from '../../logic/units';
import * as airspaces from '../../redux/airspace-slice';
import * as airways from '../../redux/airways-slice';
import { setApiLoading } from '../../redux/app-slice';
import { setAltitudeMultiplier } from '../../redux/arcgis-slice';
import {
  LivePilot,
  getLivePilots,
  setDisplayLabels,
  setDisplayLabels as setDisplayLiveLabels,
  setFetchMillis,
  setHistoryMin,
  setReturnUrl,
  updateTrackers,
} from '../../redux/live-track-slice';
import { setEnabled } from '../../redux/planner-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { setLockOnPilot } from '../../redux/track-slice';
import './about-modal';
import './live-modal';
import './pref-modal';
import './track-modal';

@customElement('main-menu')
export class MainMenu extends connect(store)(LitElement) {
  @state()
  view3d = false;
  @state()
  exaggeration = 1;
  @state()
  plannerEnabled = false;
  @state()
  requestingLocation = false;

  stateChanged(state: RootState): void {
    this.view3d = state.app.view3d;
    this.exaggeration = state.arcgis.altMultiplier;
    this.plannerEnabled = state.planner.enabled;
    this.requestingLocation = state.location.requestingLocation;
  }

  render(): TemplateResult {
    return html`<style>
        ion-item i.las {
          margin-right: 5px;
        }
        .about-alert {
          --max-width: 350px;
        }
        @keyframes spinner {
          to {
            transform: rotate(360deg);
          }
        }
        .spinner {
          animation: spinner 1s linear infinite;
        }
      </style>
      <ion-menu side="end" type="overlay" swipe-gesture="false" menu-id="main" content-id="main">
        <ion-header>
          <ion-toolbar color="light">
            <ion-title>FlyXC.app</ion-title>
            <ion-buttons slot="end">
              <ion-menu-button><i class="las la-times"></i></ion-menu-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list>
            <view-items></view-items>
            <track-items></track-items>
            <live-items></live-items>
            ${when(
              !this.view3d,
              () =>
                html`<ion-item button lines="full" @click=${this.handlePlanner} .detail=${false}>
                  <i class="las la-drafting-compass la-2x"></i>XC planning
                  <ion-toggle slot="end" .checked=${this.plannerEnabled} aria-label="XC Planning"></ion-toggle>
                </ion-item>`,
            )}
            <airways-items></airways-items>
            <airspace-items></airspace-items>
            ${when(
              this.view3d,
              () =>
                html`<ion-item lines="none"><i class="las la-mountain la-2x"></i>Altitude exaggeration</ion-item>
                  <ion-item @ionChange=${this.handleExaggeration}>
                    <ion-range
                      min="1"
                      max="2.6"
                      step="0.2"
                      debounce="50"
                      value=${this.exaggeration}
                      .pin=${true}
                      .pinFormatter=${this.formatTimes}
                    >
                      <ion-label slot="start">1.0x</ion-label>
                      <ion-label slot="end">2.6x</ion-label>
                    </ion-range>
                  </ion-item>`,
            )}
            <fullscreen-items></fullscreen-items>
            <ion-item
              button
              @click=${() => requestCurrentPosition(true)}
              .disabled=${this.requestingLocation}
              .detail=${false}
              lines="full"
            >
              <i class=${`las la-2x ${this.requestingLocation ? 'la-circle-notch spinner' : 'la-crosshairs'}`}></i
              >Center on my location
            </ion-item>
            <ion-item button @click=${this.handleSounding} lines="full" .detail=${false}>
              <i class="las la-chart-line la-2x" style="transform: rotate(90deg)"></i>Sounding
            </ion-item>
            <ion-item button @click=${this.handlePreferences} lines="full" .detail=${true}>
              <i class="las la-cog la-2x"></i>Preferences
            </ion-item>
            <ion-item button @click=${this.handleAbout} lines="full" .detail=${true}>
              <i class="las la-info la-2x"></i>About</ion-item
            >
          </ion-list>
        </ion-content>
      </ion-menu>`;
  }

  protected createRenderRoot(): Element {
    return this;
  }

  private formatTimes(value: number) {
    return `${value.toFixed(1)}x`;
  }

  private handleSounding() {
    const { lat, lon } = store.getState().location.location;
    window.open(`https://www.windy.com/plugins/windy-plugin-sounding?lat=${lat}&lon=${lon}`, '_blank');
  }

  private async handlePlanner() {
    if (!this.plannerEnabled) {
      await menuController.close();
    }
    store.dispatch(setEnabled(!this.plannerEnabled));
  }

  private async handleAbout() {
    const modal = await modalController.create({
      component: 'about-modal',
    });
    await modal.present();
  }

  private async handlePreferences() {
    const modal = await modalController.create({
      component: 'pref-modal',
    });
    await modal.present();
  }

  private handleExaggeration(e: CustomEvent) {
    store.dispatch(setAltitudeMultiplier(Number(e.detail.value ?? 1)));
  }
}

@customElement('airspace-items')
export class AirspaceItems extends connect(store)(LitElement) {
  @state()
  unit!: DistanceUnit;
  @state()
  private maxAltitude = 1000;
  @state()
  private altitudeStops: number[] = [];
  @state()
  private showRestricted = true;
  @state()
  private show = false;

  private subscriptions: UnsubscribeHandle[] = [];

  stateChanged(state: RootState): void {
    this.unit = state.units.altitude;
    this.maxAltitude = state.airspace.maxAltitude;
    this.altitudeStops = sel.airspaceAltitudeStops(state);
    this.showRestricted = state.airspace.showRestricted;
    this.show = state.airspace.show;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.subscriptions.push(
      msg.trackGroupsAdded.subscribe(() => this.updateMaxAltitude()),
      msg.trackGroupsRemoved.subscribe(() => this.updateMaxAltitude()),
    );
    this.updateMaxAltitude();
  }

  disconnectedCallback(): void {
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
  }

  render(): TemplateResult {
    return html`<ion-item lines=${this.show ? 'none' : 'full'} button @click=${this.handleShow} .detail=${false}>
        <i class="las la-fighter-jet la-2x"></i>Airspaces
        <ion-toggle slot="end" .checked=${this.show} aria-label="Airspaces"></ion-toggle>
      </ion-item>
      ${when(
        this.show,
        () => html`<ion-item button lines="none" @click=${this.handleShowRestricted}>
            <ion-label>E, F, G, restricted</ion-label>
            <ion-toggle slot="end" .checked=${this.showRestricted} aria-label="E, F, G, restricted"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-select
              label="Floor below"
              @ionChange=${this.handleMaxAltitude}
              .value=${this.maxAltitude}
              interface="popover"
            >
              ${this.altitudeStops.map(
                (altitude: number) =>
                  html`<ion-select-option .value=${altitude}> ${formatUnit(altitude, this.unit)}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>`,
      )}`;
  }

  // Updates the altitude select with the max altitude across tracks.
  // Triggered on init and when tracks get added or removed.
  private updateMaxAltitude(): void {
    const stops = this.altitudeStops;
    const state = store.getState();

    if (stops.length > 0 && sel.numTracks(state) > 0) {
      const maxAlt = sel.maxAlt(state);
      store.dispatch(airspaces.setMaxAltitude(stops.find((alt) => alt >= maxAlt) ?? stops[stops.length - 1]));
    }
  }

  private handleShow() {
    store.dispatch(airspaces.setShow(!this.show));
  }

  private handleShowRestricted() {
    store.dispatch(airspaces.setShowRestricted(!this.showRestricted));
  }

  private handleMaxAltitude(event: CustomEvent) {
    store.dispatch(airspaces.setMaxAltitude(event.detail.value));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('airways-items')
export class SkywaysItems extends connect(store)(LitElement) {
  @state()
  private opacity = 100;
  @state()
  private show = false;

  stateChanged(state: RootState): void {
    this.opacity = state.airways.opacity;
    this.show = state.airways.show;
  }

  render(): TemplateResult {
    return html`<ion-item lines=${this.show ? 'none' : 'full'} button @click=${this.handleShow} .detail=${false}>
        <i class="las la-road la-2x"></i>Airways
        <ion-toggle slot="end" .checked=${this.show} aria-label="Airways"></ion-toggle>
      </ion-item>
      ${when(
        this.show,
        () => html`<ion-item @ionChange=${this.handleOpacity}>
          <ion-range
            min="20"
            max="100"
            step="5"
            debounce="50"
            value=${this.opacity}
            .pin=${true}
            .pinFormatter=${this.formatPercent}
          >
            <ion-label slot="start"><i class="las la-adjust"></i></ion-label>
            <ion-label slot="end"><i class="las la-adjust la-2x"></i></ion-label>
          </ion-range>
        </ion-item>`,
      )}`;
  }

  private handleShow() {
    store.dispatch(airways.setShow(!this.show));
  }

  private handleOpacity(event: CustomEvent) {
    store.dispatch(airways.setOpacity(event.detail.value));
  }

  private formatPercent(value: number) {
    return `${value}%`;
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('view-items')
export class ViewItems extends connect(store)(LitElement) {
  @state()
  view3d = false;

  stateChanged(state: RootState): void {
    this.view3d = state.app.view3d;
  }

  render(): TemplateResult {
    const href = `${this.view3d ? '/' : '/3d'}${location.search}`;
    const icon = this.view3d ? 'la-map' : 'la-globe';
    return html`<ion-item button href=${href} @click=${this.handleSwitch} lines="full" .detail=${false}>
      <i class=${`las la-2x ${icon}`}></i>
      Switch to ${this.view3d ? '2d' : '3d'}
    </ion-item>`;
  }

  private handleSwitch() {
    store.dispatch(setApiLoading(true));
    menuController.close();
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('fullscreen-items')
export class FullScreenItems extends connect(store)(LitElement) {
  @state()
  private fullscreen = true;

  stateChanged(state: RootState): void {
    this.fullscreen = state.browser.isFullscreen;
  }

  render(): TemplateResult {
    const icon = this.fullscreen ? 'la-compress' : 'la-expand';
    return html`<ion-item button @click=${this.handleSwitch} lines="full" .detail=${false}>
      <i class=${`las la-2x ${icon}`}></i>
      ${this.fullscreen ? 'Exit full screen' : 'Full screen'}
    </ion-item>`;
  }

  private handleSwitch() {
    const element = document.querySelector('.fs-enabled');
    if (element) {
      if (!this.fullscreen) {
        const el = element as any;
        if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else {
          element.requestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    }
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('track-items')
export class TrackItems extends connect(store)(LitElement) {
  @state()
  private numTracks = 0;
  @state()
  private displayLabels = false;
  @state()
  private lockOnPilot = true;

  stateChanged(state: RootState): void {
    this.numTracks = sel.numTracks(state);
    this.displayLabels = state.track.displayLabels;
    this.lockOnPilot = state.track.lockOnPilot;
  }

  render(): TemplateResult {
    const hasTracks = this.numTracks > 0;
    return html`<ion-item .button=${hasTracks} .detail=${hasTracks} @click=${this.handleSelect} lines="none">
        <i class="las la-route la-2x"></i>Tracks
        ${when(hasTracks, () => html`<ion-badge slot="end" color="primary">${this.numTracks}</ion-badge>`)}
      </ion-item>
      <ion-item lines=${hasTracks ? 'none' : 'full'} button @click=${this.forwardClick}>
        Load
        <input
          type="file"
          multiple
          id="track"
          tabindex="-1"
          style="position:absolute; left: 9999px;"
          @change=${this.handleUpload}
        />
      </ion-item>
      ${when(
        hasTracks,
        () => html` <ion-item lines="none" button @click=${this.handleDisplayNames} .detail=${false}>
            <ion-label>Labels</ion-label>
            <ion-toggle slot="end" .checked=${this.displayLabels} aria-label="Labels"></ion-toggle>
          </ion-item>
          <ion-item lines="full" button @click=${this.handleLock} .detail=${false}>
            Lock on pilot
            <ion-toggle slot="end" .checked=${this.lockOnPilot} aria-label="Lock on pilot"></ion-toggle>
          </ion-item>`,
      )}`;
  }

  private handleLock() {
    store.dispatch(setLockOnPilot(!this.lockOnPilot));
  }

  // Programmatically opens the file dialog.
  private forwardClick(): void {
    (this.renderRoot.querySelector('#track') as HTMLInputElement)?.click();
  }

  private async handleUpload(e: Event): Promise<void> {
    if (e.target) {
      const el = e.target as HTMLInputElement;
      if (el.files?.length) {
        const files: File[] = [];
        for (let i = 0; i < el.files.length; i++) {
          files.push(el.files[i]);
        }
        const ids = await uploadTracks(files);
        pushCurrentState();
        addUrlParamValues(ParamNames.groupId, ids);
        el.value = '';
      }
    }
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(): void {
    store.dispatch(setDisplayLabels(!this.displayLabels));
  }

  private async handleSelect() {
    if (this.numTracks == 0) {
      return;
    }
    const modal = await modalController.create({
      component: 'track-modal',
    });
    await modal.present();
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('live-items')
export class LiveTrackItems extends connect(store)(LitElement) {
  @state()
  private displayLabels = true;
  @state()
  private pilots: LivePilot[] = [];
  @state()
  private historyMin = 0;

  stateChanged(state: RootState): void {
    this.displayLabels = state.liveTrack.displayLabels;
    this.pilots = getLivePilots(state);
    this.historyMin = state.liveTrack.historyMin;
  }

  render(): TemplateResult {
    const hasEmergency = this.pilots.some((p) => p.isEmergency == true);
    const numPilots = this.pilots.length;
    const hasPilots = numPilots > 0;

    return html`<ion-item lines="none" .button=${hasPilots} .detail=${hasPilots} @click=${this.handleSelect}>
        <i class="las la-satellite-dish la-2x"></i>Live tracks
        ${when(
          hasPilots,
          () => html`<ion-badge slot="end" color=${hasEmergency ? 'warning' : 'primary'}>${numPilots}</ion-badge>`,
        )}
      </ion-item>
      <ion-item button detail lines="none" @click=${this.handleConfig}>
        <ion-label>Setup</ion-label>
      </ion-item>
      <ion-item lines="none" button @click=${this.handleDisplayNames} .detail=${false}>
        <ion-label>Labels</ion-label>
        <ion-toggle slot="end" .checked=${this.displayLabels} aria-label="Labels"></ion-toggle>
      </ion-item>
      <ion-item lines="full" button .detail=${false}>
        <ion-label position="floating">History</ion-label>
        <ion-select
          aria-label="History"
          id="history-select"
          placeholder="length"
          interface="popover"
          value=${this.historyMin}
          @ionChange=${this.handleHistory}
        >
          <ion-select-option value=${40}>40mn</ion-select-option>
          <ion-select-option value=${12 * 60}>12h</ion-select-option>
          <ion-select-option value=${24 * 60}>24h</ion-select-option>
        </ion-select>
      </ion-item> `;
  }

  private async handleSelect() {
    if (this.pilots.length > 0) {
      const modal = await modalController.create({
        component: 'live-modal',
      });
      await modal.present();
    }
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(): void {
    store.dispatch(setDisplayLiveLabels(!this.displayLabels));
  }

  private handleHistory(e: CustomEvent): void {
    store.dispatch(setHistoryMin(Number(e.detail.value)));
    store.dispatch(setFetchMillis(0));
    store.dispatch(updateTrackers());
  }

  private handleConfig() {
    store.dispatch(setReturnUrl(document.location.toString()));
    document.location.href = '/devices';
  }

  protected createRenderRoot(): Element {
    return this;
  }
}
