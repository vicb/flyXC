import { LatLon } from 'flyxc/common/src/runtime-track';
import { getDistance } from 'geolib';
import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import * as msg from '../../logic/messages';
import { DistanceUnit, formatDistance, formatDurationMin } from '../../logic/units';
import { getLivePilots, LivePilot, setCenterOnLocation, setCurrentLiveId } from '../../redux/live-track-slice';
import { setCurrentLocation } from '../../redux/location-slice';
import { RootState, store } from '../../redux/store';
import { getUniqueColor } from '../../styles/track';
import { getMenuController, getModalController, getToastController } from './ion-controllers';

// Maximum number of pilots to list.
const MAX_PILOTS = 40;

// How long tracks are considered recent.
const RECENT_PILOTS_HOUR = 3;

const enum OrderBy {
  Time,
  Distance,
}

@customElement('live-modal')
export class LiveModal extends connect(store)(LitElement) {
  @internalProperty()
  private pilots: LivePilot[] = [];
  @internalProperty()
  private orderBy = OrderBy.Distance;
  @internalProperty()
  private distanceUnit!: DistanceUnit;
  @internalProperty()
  private centerOnLocation = false;
  @internalProperty()
  private location!: LatLon;

  private watchLocationId = 0;

  stateChanged(state: RootState): void {
    this.pilots = getLivePilots(state);
    this.location = state.location.location;
    this.distanceUnit = state.units.distance;
    this.centerOnLocation = state.liveTrack.centerOnLocation;
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

  protected createRenderRoot(): Element {
    return this;
  }

  private async handleCenter(): Promise<void> {
    const watch = !this.centerOnLocation;
    await this.watchLocation(watch);
    store.dispatch(setCenterOnLocation(watch));
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

        const toast = await getToastController().create({
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
    await getMenuController().close();
  }

  // Returns the templates for all the pilots.
  private getPilotItems(): TemplateResult[] {
    const nowSec = Date.now() / 1000;
    let pilots = [...this.pilots];
    const distances = new Map<number, number>();

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
      return pilots.map((pilot: LivePilot) => this.getPilotItem(pilot, distances.get(pilot.id) as number, nowSec));
    }

    const recent: LivePilot[] = [];
    const old: LivePilot[] = [];
    const recentTimeSec = nowSec - RECENT_PILOTS_HOUR * 3600;

    pilots.forEach((pilot) => {
      if (pilot.timeSec < recentTimeSec) {
        old.push(pilot);
      } else {
        recent.push(pilot);
      }
    });

    const parts: TemplateResult[] = [];

    if (recent.length > 0) {
      parts.push(html`<ion-item-divider class="divider" sticky color="light">Recent</ion-item-divider>`);
      parts.push(...recent.map((pilot) => this.getPilotItem(pilot, distances.get(pilot.id) as number, nowSec)));
    }

    if (old.length > 0) {
      parts.push(
        html`<ion-item-divider class="divider" sticky color="light"
          >Older than ${RECENT_PILOTS_HOUR}h</ion-item-divider
        >`,
      );
      parts.push(...old.map((pilot) => this.getPilotItem(pilot, distances.get(pilot.id) as number, nowSec)));
    }

    return parts;
  }

  // Returns the template for a single pilot.
  private getPilotItem(pilot: LivePilot, distance: number, nowSec: number): TemplateResult {
    const ageMin = (nowSec - pilot.timeSec) / 60;
    return html`<ion-item
      button
      @click=${() => this.handleFlyTo(pilot)}
      lines="full"
      color=${pilot.isEmergency ? 'warning' : ''}
    >
      <i
        slot="start"
        class="las la-user-astronaut la-2x"
        style=${`color: ${getUniqueColor(Math.round(pilot.id / 1000))}`}
      ></i>
      <ion-label class="ion-text-wrap">
        <h2>${pilot.name}</h2>
        ${pilot.message
          ? html`<p>
              <i class="las la-sms"></i>“${pilot.message.text}”
              (${formatDurationMin((nowSec - pilot.message.timeSec) / 60)} ago)
            </p>`
          : null}
      </ion-label>
      <span slot="end">
        <ion-chip color="secondary">-${formatDurationMin(ageMin)}</ion-chip>
        <ion-chip color="primary" style="margin-left: 5px">${formatDistance(distance, this.distanceUnit)}</ion-chip>
      </span>
    </ion-item>`;
  }

  private async dismiss(): Promise<any> {
    const modal = await getModalController().getTop();
    await modal?.dismiss();
  }
}
