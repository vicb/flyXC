import { LatLon } from 'flyxc/common/src/runtime-track';
import { getDistance } from 'geolib';
import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import * as msg from '../../logic/messages';
import { DistanceUnit, formatDistance, formatDurationMin } from '../../logic/units';
import { getLivePilots, LivePilot } from '../../redux/live-track-slice';
import { RootState, store } from '../../redux/store';
import { getUniqueColor } from '../../styles/track';
import { getMenuController, getModalController } from './ion-controllers';

const MAX_PILOTS = 40;

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
      <ion-content class="ion-padding">
        <ion-list>${this.getPilotList()}</ion-list>
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
    // Does not work in 3D ?
    msg.centerMap.emit(pilot.position);
    await this.dismiss();
    await getMenuController().close();
  }

  private getPilotList(): TemplateResult[] {
    const nowSec = Date.now() / 1000;
    let pilots = [...this.pilots];

    if (this.orderBy == OrderBy.Time) {
      pilots.sort((a, b) => b.timeSec - a.timeSec);
      pilots = pilots.slice(0, MAX_PILOTS - 1);

      return pilots.map((pilot: LivePilot) => {
        const ageMin = (nowSec - pilot.timeSec) / 60;
        return html`<ion-item button @click=${() => this.handleFlyTo(pilot)}>
          <i class="las la-user-astronaut la-2x" style=${`color: ${getUniqueColor(Math.round(pilot.id / 1000))}`}></i
          >${pilot.name}
          <ion-badge slot="end" color="primary">-${formatDurationMin(ageMin)}</ion-badge>
        </ion-item>`;
      });
    }

    // Order by distance
    const distances = new Map<number, number>();

    pilots.forEach((pilot) => {
      const distance = Math.round(getDistance(this.location, pilot.position));
      distances.set(pilot.id, distance);
    });

    pilots.sort((a, b) => (distances.get(a.id) as number) - (distances.get(b.id) as number));
    pilots = pilots.slice(0, MAX_PILOTS - 1);

    return pilots.map((pilot: LivePilot) => {
      const distance = distances.get(pilot.id) as number;
      return html`<ion-item button @click=${() => this.handleFlyTo(pilot)}>
        <i class="las la-user-astronaut la-2x" style=${`color: ${getUniqueColor(Math.round(pilot.id / 1000))}`}></i
        >${pilot.name}
        <ion-badge slot="end" color="primary">${formatDistance(distance, this.distanceUnit)}</ion-badge>
      </ion-item>`;
    });
  }

  private async dismiss(): Promise<any> {
    const modal = await getModalController().getTop();
    await modal?.dismiss();
  }
}
