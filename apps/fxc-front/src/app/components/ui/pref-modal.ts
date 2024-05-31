import { html, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { modalController } from '@ionic/core/components';

import { LEAGUES_NAMES } from '../../logic/score/league/leagues';
import * as units from '../../logic/units';
import { setLeague } from '../../redux/planner-slice';
import { RootState, store } from '../../redux/store';
import { setAltitudeUnit, setDistanceUnit, setSpeedUnit, setVarioUnit } from '../../redux/units-slice';

@customElement('pref-modal')
export class PrefModal extends connect(store)(LitElement) {
  @state()
  league = 'xc';
  @state()
  units!: units.Units;

  private leagues: { value: string; name: string }[] = [];

  constructor() {
    super();
    Object.getOwnPropertyNames(LEAGUES_NAMES).forEach((value) => {
      this.leagues.push({ value, name: LEAGUES_NAMES[value] });
    });
    this.leagues.sort((a, b) => (a < b ? -1 : 1));
  }

  stateChanged(state: RootState): void {
    this.league = state.planner.league;
    this.units = state.units;
  }

  render(): TemplateResult {
    return html`<style>
        ion-popover.league {
          --width: 300px;
        }
      </style>
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>FlyXC preferences</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item>
            <ion-select
              @ionChange=${this.handleLeague}
              value=${this.league}
              interface="popover"
              .interfaceOptions=${{ cssClass: 'league' }}
              label="League"
              label-placement="floating"
            >
              ${this.leagues.map(
                (league) => html` <ion-select-option value=${league.value}>${league.name}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-select
              label="Distance"
              @ionChange=${this.handleDistance}
              value=${this.units.distance}
              interface="popover"
            >
              <ion-select-option value=${units.DistanceUnit.Kilometers}>kilometers</ion-select-option>
              <ion-select-option value=${units.DistanceUnit.Miles}>miles</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-select label="Speed" @ionChange=${this.handleSpeed} value=${this.units.speed} interface="popover">
              <ion-select-option value=${units.SpeedUnit.KilometersPerHour}>km/h</ion-select-option>
              <ion-select-option value=${units.SpeedUnit.MilesPerHour}>mi/h</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-select
              label="Altitude"
              @ionChange=${this.handleAltitude}
              value=${this.units.altitude}
              interface="popover"
            >
              <ion-select-option value=${units.DistanceUnit.Meters}>meters</ion-select-option>
              <ion-select-option value=${units.DistanceUnit.Feet}>feet</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-select label="Vario" @ionChange=${this.handleVario} value=${this.units.vario} interface="popover">
              <ion-select-option value=${units.SpeedUnit.MetersPerSecond}>m/s</ion-select-option>
              <ion-select-option value=${units.SpeedUnit.FeetPerMinute}>ft/min</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-list>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.dismiss}>Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer> `;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private handleLeague(e: CustomEvent) {
    store.dispatch(setLeague(e.detail.value));
  }

  private handleDistance(e: CustomEvent) {
    store.dispatch(setDistanceUnit(e.detail.value));
  }

  private handleSpeed(e: CustomEvent) {
    store.dispatch(setSpeedUnit(e.detail.value));
  }

  private handleAltitude(e: CustomEvent) {
    store.dispatch(setAltitudeUnit(e.detail.value));
  }

  private handleVario(e: CustomEvent) {
    store.dispatch(setVarioUnit(e.detail.value));
  }

  private async dismiss(): Promise<void> {
    const modal = await modalController.getTop();
    await modal?.dismiss();
  }
}
