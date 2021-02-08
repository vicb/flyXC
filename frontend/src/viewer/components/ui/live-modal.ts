import { LatLon } from 'flyxc/common/src/runtime-track';
import { getDistance } from 'geolib';
import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import * as msg from '../../logic/messages';
import { DistanceUnit, formatDistance, formatDurationMin } from '../../logic/units';
import { getLivePilots, LivePilot, setCurrentLiveId } from '../../redux/live-track-slice';
import { RootState, store } from '../../redux/store';
import { getUniqueColor } from '../../styles/track';
import { getMenuController, getModalController } from './ion-controllers';

const MAX_PILOTS = 40;

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

  private location!: LatLon;

  stateChanged(state: RootState): void {
    this.pilots = getLivePilots(state);
    this.location = state.location.current?.latLon as LatLon;
    this.distanceUnit = state.units.distance;
  }

  connectedCallback(): void {
    super.connectedCallback();
    msg.requestLocation.emit();
  }

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>FlyTo</ion-title>
          <ion-buttons slot="end">
            <ion-button
              color=${this.orderBy == OrderBy.Time ? 'dark' : 'medium'}
              @click=${() => (this.orderBy = OrderBy.Time)}
              ><i slot="icon-only" class="la la-clock la-2x"></i
            ></ion-button>
            <ion-button
              color=${this.orderBy == OrderBy.Distance ? 'dark' : 'medium'}
              @click=${() => (this.orderBy = OrderBy.Distance)}
              ><i slot="icon-only" class="la la-ruler la-2x"></i
            ></ion-button>
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
      pilots.sort((a, b) => b.timeSec - a.timeSec);
    } else {
      pilots.sort((a, b) => (distances.get(a.id) as number) - (distances.get(b.id) as number));
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
    return html`<ion-item button @click=${() => this.handleFlyTo(pilot)} lines="full">
      <i class="las la-user-astronaut la-2x" style=${`color: ${getUniqueColor(Math.round(pilot.id / 1000))}`}></i
      >${pilot.name}
      <span slot="end">
        <ion-badge color="secondary">-${formatDurationMin(ageMin)}</ion-badge>
        <ion-badge color="primary" style="margin-left: 5px">${formatDistance(distance, this.distanceUnit)}</ion-badge>
      </span>
    </ion-item>`;
  }

  private async dismiss(): Promise<any> {
    const modal = await getModalController().getTop();
    await modal?.dismiss();
  }
}
