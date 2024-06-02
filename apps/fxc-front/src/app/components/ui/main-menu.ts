import { Class, Type, getClassName, getTypeName } from '@flyxc/common';
import { SearchbarCustomEvent, ToggleCustomEvent, modalController, toastController } from '@ionic/core/components';
import { LitElement, TemplateResult, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';
import { requestCurrentPosition } from '../../logic/geolocation';
import { ParamNames, addUrlParamValues, pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { uploadTracks } from '../../logic/track';
import { DistanceUnit, formatUnit } from '../../logic/units';
import * as airspaces from '../../redux/airspace-slice';
import { setApiLoading } from '../../redux/app-slice';
import * as arcgis from '../../redux/arcgis-slice';
import {
  LivePilot,
  getLivePilots,
  setDisplayLabels as setDisplayLiveLabels,
  setFetchMillis,
  setHistoryMin,
  setReturnUrl,
  updateTrackers,
} from '../../redux/live-track-slice';
import { setEnabled } from '../../redux/planner-slice';
import * as sel from '../../redux/selectors';
import * as skyways from '../../redux/skyways-slice';
import { RootState, store } from '../../redux/store';
import { setDisplayLabels, setLockOnPilot } from '../../redux/track-slice';
import './about-modal';
import './live-modal';
import './pref-modal';
import './track-modal';
import './supporter-modal';
import { getApiKeyAndHost } from '../../apikey';
import { geocode } from '@esri/arcgis-rest-geocoding';
import { setDefaultRequestOptions } from '@esri/arcgis-rest-request';
import { maybeHideSidePane } from '../../../flyxc';

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
  @state()
  sunEnabled = false;

  stateChanged(state: RootState): void {
    this.view3d = state.app.view3d;
    this.exaggeration = state.arcgis.altMultiplier;
    this.plannerEnabled = state.planner.enabled;
    this.requestingLocation = state.location.requestingLocation;
    this.sunEnabled = state.arcgis.useSunLighting;
  }

  render(): TemplateResult {
    return html`<ion-menu swipe-gesture="false" menu-id="main" content-id="main">
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>FlyXC.app</ion-title>
          <ion-buttons slot="end">
            <ion-button @click=${this.closeSplitPane} shape="round">
              <i class="las la-times"></i>
            </ion-button>
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
              html`<ion-item button lines="full" .detail=${false}>
                <ion-toggle .checked=${this.plannerEnabled} @ionChange=${this.handlePlanner}
                  ><i class="las la-drafting-compass la-2x val-mid"></i
                  ><span class="val-mid">XC planning</span></ion-toggle
                >
              </ion-item>`,
          )}
          <skyways-items></skyways-items>
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
                    aria-label="Altitude exaggeration"
                    value=${this.exaggeration}
                    .pin=${true}
                    .pinFormatter=${this.formatTimes}
                  >
                    <ion-label slot="start">1.0x</ion-label>
                    <ion-label slot="end">2.6x</ion-label>
                  </ion-range>
                </ion-item>
                <ion-item button lines="full" .detail=${false}>
                  <ion-toggle .checked=${this.sunEnabled} @ionChange=${this.handleSun}
                    ><i class="las la-sun la-2x val-mid"></i><span class="val-mid">Sun lighting</span></ion-toggle
                  >
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
            <i class=${`las la-2x ${this.requestingLocation ? 'la-circle-notch spinner' : 'la-crosshairs'}`}></i>Center
            on my location
          </ion-item>
          <ion-item button @click=${this.handleSounding} lines="full" .detail=${false}>
            <i class="las la-chart-line la-2x" style="transform: rotate(90deg)"></i>Sounding</ion-item
          >
          <ion-item button @click=${this.handlePreferences} lines="full" .detail=${true}>
            <i class="las la-cog la-2x"></i>Preferences</ion-item
          >
          <ion-item button @click=${this.handleAbout} lines="full" .detail=${false}>
            <i class="las la-info la-2x"></i>About</ion-item
          >
          <ion-item button @click=${this.handleSupport} lines="full" .detail=${true}>
            <i class="las la-hand-holding-usd la-2x"></i>Support flyxc</ion-item
          >
          <ion-item @lines="full" .detail=${false} class="social">
            <a
              href="https://www.facebook.com/flyxcapp"
              target="_blank"
              title="Find us on facebook"
              slot="start"
              rel="external"
              ><i class="lab la-facebook la-2x"></i
            ></a>
            <a
              href="https://github.com/vicb/flyxc"
              target="_blank"
              title="Find us on github"
              slot="start"
              rel="external"
              ><i class="lab la-github la-2x"></i
            ></a>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-menu>`;
  }

  protected closeSplitPane() {
    const splitPane = document.querySelector('ion-split-pane');
    if (splitPane) {
      splitPane.when = false;
    }
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private formatTimes(value: number) {
    return `${value.toFixed(1)}x`;
  }

  private handleSounding() {
    const { lat, lon } = store.getState().location.location;
    window.open(`https://www.windy.com/plugin/sdg/${lat}/${lon}`, '_blank');
  }

  private async handleSupport() {
    const modal = await modalController.create({
      component: 'supporter-modal',
    });
    await modal.present();
  }

  private async handlePlanner() {
    if (!this.plannerEnabled) {
      await maybeHideSidePane();
    }
    store.dispatch(setEnabled(!this.plannerEnabled));
  }

  private async handleSun() {
    store.dispatch(arcgis.setUseSunLighting(!this.sunEnabled));
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
    store.dispatch(arcgis.setAltitudeMultiplier(Number(e.detail.value ?? 1)));
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
  private show = false;
  @state()
  private showClasses: Class[] = [];
  @state()
  private showTypes: Type[] = [];

  private subscriptions: UnsubscribeHandle[] = [];

  stateChanged(state: RootState): void {
    this.unit = state.units.altitude;
    this.maxAltitude = state.airspace.maxAltitude;
    this.altitudeStops = sel.airspaceAltitudeStops(state);
    this.show = state.airspace.show;
    this.showClasses = state.airspace.showClasses;
    this.showTypes = state.airspace.showTypes;
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
    for (const sub of this.subscriptions) {
      sub();
    }
    this.subscriptions.length = 0;
  }

  render(): TemplateResult {
    return html`<ion-item lines=${this.show ? 'none' : 'full'} button .detail=${false}>
        <ion-toggle .checked=${this.show} @ionChange=${this.handleShow}
          ><i class="las la-fighter-jet la-2x val-mid"></i><span class="val-mid">Airspaces</span></ion-toggle
        >
      </ion-item>
      ${when(
        this.show,
        () => html`<ion-item button lines="none" .detail="${false}">
            <ion-select
              label-placement="floating"
              label="Classes"
              .value=${this.showClasses}
              .multiple=${true}
              @ionChange=${this.onClassesChange}
              class="ion-text-wrap small-text"
            >
              ${map(
                [Class.A, Class.B, Class.C, Class.D, Class.E, Class.F, Class.G],
                (icaoClass) =>
                  html`<ion-select-option .value=${icaoClass}>${getClassName(icaoClass)}</ion-select-option>`,
              )}
            </ion-select>
          </ion-item>
          <ion-item button lines="none" .detail="${false}">
            <ion-select
              label-placement="floating"
              label="Types"
              .value=${this.showTypes}
              .multiple=${true}
              @ionChange=${this.onTypesChange}
              class="ion-text-wrap small-text"
            >
              ${map(
                [
                  Type.Prohibited,
                  Type.Restricted,
                  Type.Danger,
                  Type.CTR,
                  Type.TMA,
                  Type.RMZ,
                  Type.TMZ,
                  Type.GlidingSector,
                  Type.Other,
                ],
                (type) =>
                  html`<ion-select-option .value=${type}
                    >${type == Type.Other ? 'Other' : getTypeName(type)}</ion-select-option
                  >`,
              )}
            </ion-select>
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

  private onClassesChange(e: ToggleCustomEvent) {
    store.dispatch(airspaces.showClasses(e.detail.value));
  }

  private onTypesChange(e: ToggleCustomEvent) {
    store.dispatch(airspaces.showTypes(e.detail.value));
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

  private handleMaxAltitude(event: CustomEvent) {
    store.dispatch(airspaces.setMaxAltitude(event.detail.value));
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('skyways-items')
export class SkywaysItems extends connect(store)(LitElement) {
  @state()
  private opacity = 100;
  @state()
  private show = false;
  @state()
  private layer: skyways.Layer = 'skyways';
  @state()
  private month: skyways.Month = 'all';
  @state()
  private timeOfDay: skyways.TimeOfDay = 'all';

  stateChanged(state: RootState): void {
    this.opacity = state.skyways.opacity;
    this.show = state.skyways.show;
    this.layer = state.skyways.layer;
    this.month = state.skyways.month;
    this.timeOfDay = state.skyways.timeOfDay;
  }

  render(): TemplateResult {
    return html`<ion-item lines=${this.show ? 'none' : 'full'} button .detail=${false}>
        <ion-toggle .checked=${this.show} @ionChange=${this.handleShow}
          ><i class="las la-road la-2x val-mid"></i><span class="val-mid">Skyways</span></ion-toggle
        >
      </ion-item>
      ${when(
        this.show,
        () => html`<ion-item lines="none" .detail=${false}>
            <ion-select label="Type" @ionChange=${this.handleLayer} .value=${this.layer} interface="popover">
              ${Object.entries(skyways.layerMap).map(
                ([value, label]: [string, string]) =>
                  html`<ion-select-option .value=${value}>${label}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>
          <ion-item lines="none" .detail=${false}>
            <ion-select label="Month" @ionChange=${this.handleMonth} .value=${this.month} interface="popover">
              ${Object.entries(skyways.monthMap).map(
                ([value, label]: [string, string]) =>
                  html`<ion-select-option .value=${value}>${label}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>
          <ion-item lines="none" .detail=${false}>
            <ion-select label="Time" @ionChange=${this.handleTimeOfDay} .value=${this.timeOfDay} interface="popover">
              ${skyways.timeOfDayList.map(
                (value: skyways.TimeOfDay) =>
                  html`<ion-select-option .value=${value}>${skyways.timeOfDayMap[value]}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>
          <ion-item @ionChange=${this.handleOpacity} .detail=${false} class="dense">
            <ion-range
              min="20"
              max="100"
              step="5"
              debounce="50"
              aria-label="Opacity"
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

  private handleLayer(event: CustomEvent) {
    store.dispatch(skyways.setLayer(event.detail.value));
  }

  private handleMonth(event: CustomEvent) {
    store.dispatch(skyways.setMonth(event.detail.value));
  }

  private handleTimeOfDay(event: CustomEvent) {
    store.dispatch(skyways.setTimeOfDay(event.detail.value));
  }

  private handleShow() {
    store.dispatch(skyways.setShow(!this.show));
  }

  private handleOpacity(event: CustomEvent) {
    store.dispatch(skyways.setOpacity(event.detail.value));
  }

  private formatPercent(value: number) {
    return `${value}%`;
  }

  protected createRenderRoot(): HTMLElement {
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
    return html`<ion-item button href=${href} @click=${this.handleSwitch} lines="none" .detail=${false}>
        <i class=${`las la-2x ${icon}`}></i>
        Switch to ${this.view3d ? '2d' : '3d'}
      </ion-item>
      <ion-item>
        <ion-searchbar
          placeholder="Go to"
          lines="full"
          .detail=${false}
          debounce="800"
          @keydown=${(e: KeyboardEvent) =>
            e.key === 'Enter' && this.handleSearch(e.target ? (e.target as HTMLIonSearchbarElement).value ?? '' : '')}
          @ionChange=${(e: SearchbarCustomEvent) => this.handleSearch(e.detail.value ?? '')}
          @ionInput=${(e: SearchbarCustomEvent) => this.handleSearch(e.detail.value ?? '')}
        >
        </ion-searchbar>
      </ion-item> `;
  }

  private async handleSearch(place: string) {
    const { lat, lon } = store.getState().location.location;
    if (place.trim().length < 2) {
      return;
    }
    const { candidates } = await geocode({
      singleLine: place,
      params: {
        token: getApiKeyAndHost('arcgis').key,
        location: `${lon},${lat}`,
        maxLocations: 1,
      },
    });
    setDefaultRequestOptions({ params: {} });
    if (candidates.length === 0) {
      return;
    }
    const { address, score } = candidates[0];
    const { y, x } = candidates[0].location;
    if (score > 50) {
      const toast = await toastController.create({
        message: `Navigated to ${address}`,
        duration: 3000,
        buttons: [
          {
            text: 'Close',
            role: 'cancel',
          },
        ],
      });
      msg.centerMap.emit({ lat: y, lon: x, alt: 0 });
      await toast.present();
    }
  }

  private async handleSwitch() {
    store.dispatch(setApiLoading(true));
    await maybeHideSidePane();
  }

  protected createRenderRoot(): HTMLElement {
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

  protected createRenderRoot(): HTMLElement {
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
        Upload tracks and routes
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
        () => html` <ion-item lines="none" button .detail=${false}>
            <ion-toggle .checked=${this.displayLabels} @ionChange=${this.handleDisplayNames}>Labels</ion-toggle>
          </ion-item>
          <ion-item lines="full" button .detail=${false}>
            <ion-toggle .checked=${this.lockOnPilot} @ionChange=${this.handleLock}>Lock on pilot</ion-toggle>
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

  private async handleUpload(e: Event & { target: HTMLInputElement }): Promise<void> {
    if (e.target) {
      const el = e.target;
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

  protected createRenderRoot(): HTMLElement {
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
        <ion-label>Settings</ion-label>
      </ion-item>
      <ion-item lines="none" button .detail=${false}>
        <ion-toggle .checked=${this.displayLabels} @ionChange=${this.handleDisplayNames}>Labels</ion-toggle>
      </ion-item>
      <ion-item lines="full" button .detail=${false}>
        <ion-select
          label="History"
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

  protected createRenderRoot(): HTMLElement {
    return this;
  }
}
