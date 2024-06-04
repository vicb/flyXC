import type * as common from '@flyxc/common';
import { modalController, toastController } from '@ionic/core/components';
import { getDistance } from 'geolib';
import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import { maybeHideSidePane } from '../../../flyxc';
import * as msg from '../../logic/messages';
import * as units from '../../logic/units';
import type { LivePilot } from '../../redux/live-track-slice';
import { getLivePilots, setCenterOnLocation, setCurrentLiveId } from '../../redux/live-track-slice';
import { setCurrentLocation } from '../../redux/location-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { getUniqueContrastColor } from '../../styles/track';

// Maximum number of pilots to list.
const MAX_PILOTS = 200;

// How long tracks are considered recent.
const RECENT_PILOTS_HOUR = 3;

enum OrderBy {
  Time,
  Distance,
}

@customElement('live-modal')
export class LiveModal extends connect(store)(LitElement) {
  @state()
  private pilots: LivePilot[] = [];
  @state()
  private orderBy = OrderBy.Distance;
  @state()
  private units!: units.Units;
  @state()
  private centerOnLocation = false;
  @state()
  private location!: common.LatLon;
  @state()
  private currentLiveId?: string;
  @state()
  private filter = '';

  private watchLocationId = 0;

  stateChanged(state: RootState): void {
    this.pilots = getLivePilots(state);
    this.location = state.location.location;
    this.units = state.units;
    this.centerOnLocation = state.liveTrack.centerOnLocation;
    this.currentLiveId = state.liveTrack.currentLiveId;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.watchLocation(this.centerOnLocation);
  }

  disconnectedCallback(): void {
    this.watchLocation(false);
  }

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>Fly to</ion-title>
          <ion-buttons slot="end">
            <ion-fab-button
              size="small"
              color=${this.centerOnLocation ? 'primary' : 'light'}
              @click=${this.handleCenter}
              ><i class="la la-crosshairs la-2x"></i
            ></ion-fab-button>
            <ion-fab-button
              size="small"
              color=${this.orderBy == OrderBy.Time ? 'primary' : 'light'}
              @click=${() => (this.orderBy = OrderBy.Time)}
              ><i class="la la-clock la-2x"></i
            ></ion-fab-button>
            <ion-fab-button
              size="small"
              color=${this.orderBy == OrderBy.Distance ? 'primary' : 'light'}
              @click=${() => (this.orderBy = OrderBy.Distance)}
              ><i class="la la-ruler la-2x"></i
            ></ion-fab-button>
          </ion-buttons>
        </ion-toolbar>
        <ion-toolbar color="light">
          <ion-searchbar placeholder="Filter" debounce="300" @ionInput=${this.filterPilots}></ion-searchbar>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>${this.getPilotItems()}</ion-list>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.dismiss}>Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    `;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private async handleCenter(): Promise<void> {
    const watch = !this.centerOnLocation;
    await this.watchLocation(watch);
    store.dispatch(setCenterOnLocation(watch));
  }

  private filterPilots(e: CustomEvent): void {
    this.filter = e.detail.value;
  }

  private async watchLocation(watch: boolean): Promise<void> {
    if ('geolocation' in navigator) {
      if (watch) {
        this.watchLocationId = navigator.geolocation.watchPosition(
          (p: GeolocationPosition) => {
            const { latitude: lat, longitude: lon } = p.coords;
            msg.centerMap.emit({ lat, lon, alt: 0 });
            store.dispatch(setCurrentLocation({ lat, lon }));
          },
          () => {
            store.dispatch(setCenterOnLocation(false));
            this.watchLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 60 * 1000,
          },
        );

        const toast = await toastController.create({
          message: 'Keeps the map centered on your current location',
          duration: 3000,
          buttons: [
            {
              text: 'Close',
              role: 'cancel',
            },
          ],
        });
        await toast.present();
      } else {
        navigator.geolocation.clearWatch(this.watchLocationId);
      }
    }
  }

  private async handleFlyTo(pilot: LivePilot) {
    msg.centerMap.emit(pilot.position);
    store.dispatch(setCurrentLiveId(pilot.id));
    await this.dismiss();
    await maybeHideSidePane();
  }

  // Returns the templates for all the pilots.
  private getPilotItems(): TemplateResult[] {
    const nowSec = Date.now() / 1000;
    let pilots = [...this.pilots];
    const distances = new Map<string, number>();

    if (this.filter.length > 0) {
      const escapedFilter = this.filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pilots = pilots.filter((pilot) => {
        return pilot.isEmergency || pilot.name.match(new RegExp(escapedFilter, 'i'));
      });
    }

    pilots.forEach((pilot) => {
      const distance = Math.round(getDistance(this.location, pilot.position));
      distances.set(pilot.id, distance);
    });

    if (this.orderBy == OrderBy.Time) {
      pilots.sort((a, b) => (a.isEmergency ? -1 : b.timeSec - a.timeSec));
    } else {
      pilots.sort((a, b) => (a.isEmergency ? -1 : (distances.get(a.id) as number) - (distances.get(b.id) as number)));
    }

    pilots = pilots.slice(0, MAX_PILOTS - 1);

    if (this.orderBy == OrderBy.Time) {
      return pilots.map((pilot: LivePilot) => {
        const note = `-${units.formatDurationMin((nowSec - pilot.timeSec) / 60)}`;
        const sub = html`<i class="la la-ruler"></i>${units.formatDistance(
            distances.get(pilot.id) as number,
            this.units.distance,
          )}`;
        return this.getPilotItem(pilot, note, sub, nowSec);
      });
    }

    const recent: TemplateResult[] = [];
    const old: TemplateResult[] = [];
    const recentTimeSec = nowSec - RECENT_PILOTS_HOUR * 3600;

    pilots.forEach((pilot) => {
      const note = units.formatDistance(distances.get(pilot.id) as number, this.units.distance);
      const sub = html`<i class="la la-clock"></i>-${units.formatDurationMin((nowSec - pilot.timeSec) / 60)}`;
      const item = this.getPilotItem(pilot, note, sub, nowSec);

      if (pilot.timeSec < recentTimeSec) {
        old.push(item);
      } else {
        recent.push(item);
      }
    });

    const parts: TemplateResult[] = [];

    if (recent.length > 0) {
      parts.push(html`<ion-item-divider class="divider" sticky color="light">Recent</ion-item-divider>`, ...recent);
    }

    if (old.length > 0) {
      parts.push(
        html`<ion-item-divider class="divider" sticky color="light"
          >Older than ${RECENT_PILOTS_HOUR}h</ion-item-divider
        >`,
        ...old,
      );
    }

    return parts;
  }

  // Returns the template for a single pilot.
  private getPilotItem(pilot: LivePilot, note: string, sub: string | TemplateResult, nowSec: number): TemplateResult {
    return html`<ion-item
      button
      @click=${() => this.handleFlyTo(pilot)}
      lines="full"
      color=${pilot.isEmergency ? 'warning' : pilot.id == this.currentLiveId ? 'primary' : ''}
    >
      <i slot="start" class="las la-user-astronaut la-2x" style=${`color: ${getUniqueContrastColor(pilot.id)}`}></i>
      <ion-label class="ion-text-wrap">
        <h2>${pilot.name}</h2>
        <p>
          <span class="nobr">${sub}</span>
          <span class="nobr">
            <i class="la la-arrows-alt-v"></i>${units.formatUnit(pilot.position.alt, this.units.altitude)}
            ${pilot.gndAlt == null
              ? ''
              : `(${units.formatUnit(Math.max(pilot.position.alt - pilot.gndAlt, 0), this.units.altitude)} AGL)`}
          </span>
          ${pilot.speed == null
            ? ''
            : html`<span class="nobr">
                <i class="la la-tachometer-alt"></i> ${units.formatUnit(pilot.speed, this.units.speed)}
              </span>`}
        </p>
        ${when(
          pilot.message,
          () =>
            html`<p>
              <i class="las la-sms"></i>“${pilot.message!.text}”
              (${units.formatDurationMin((nowSec - pilot.message!.timeSec) / 60)} ago)
            </p>`,
        )}
      </ion-label>
      <span slot="end">
        <ion-note
          color=${pilot.isEmergency || pilot.id == this.currentLiveId ? 'light' : 'primary'}
          style="margin-left: 5px"
          >${note}</ion-note
        >
      </span>
    </ion-item>`;
  }

  private async dismiss(): Promise<any> {
    const modal = await modalController.getTop();
    await modal?.dismiss();
  }
}
