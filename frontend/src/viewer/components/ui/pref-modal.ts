import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LEAGUES } from '../../logic/score/league/leagues';
import { DistanceUnit, SpeedUnit, Units } from '../../logic/units';
import { setLeague } from '../../redux/planner-slice';
import { RootState, store } from '../../redux/store';
import { setAltitudeUnit, setDistanceUnit, setSpeedUnit, setVarioUnit } from '../../redux/units-slice';
import { getModalController } from './ion-controllers';

@customElement('pref-modal')
export class PrefModal extends connect(store)(LitElement) {
  @internalProperty()
  league = 'xc';
  @internalProperty()
  units!: Units;

  private leagues: { value: string; name: string }[] = [];

  constructor() {
    super();
    Object.getOwnPropertyNames(LEAGUES).forEach((value) => {
      this.leagues.push({ value, name: LEAGUES[value].name });
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
            <ion-label position="floating">League</ion-label>
            <ion-select
              @ionChange=${this.handleLeague}
              value=${this.league}
              interface="popover"
              .interfaceOptions=${{ cssClass: 'league' }}
            >
              ${this.leagues.map(
                (league) => html` <ion-select-option value=${league.value}>${league.name}</ion-select-option> `,
              )}
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="floating">Distance</ion-label>
            <ion-select @ionChange=${this.handleDistance} value=${this.units?.distance} interface="popover">
              <ion-select-option value=${DistanceUnit.Kilometers}>kilometers</ion-select-option>
              <ion-select-option value=${DistanceUnit.Miles}>miles</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="floating">Speed</ion-label>
            <ion-select @ionChange=${this.handleSpeed} value=${this.units?.speed} interface="popover">
              <ion-select-option value=${SpeedUnit.KilometersPerHour}>km/h</ion-select-option>
              <ion-select-option value=${SpeedUnit.MilesPerHour}>mi/h</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="floating">Altitude</ion-label>
            <ion-select @ionChange=${this.handleAltitude} value=${this.units?.altitude} interface="popover">
              <ion-select-option value=${DistanceUnit.Meters}>meters</ion-select-option>
              <ion-select-option value=${DistanceUnit.Feet}>feet</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="floating">Vario</ion-label>
            <ion-select @ionChange=${this.handleVario} value=${this.units?.vario} interface="popover">
              <ion-select-option value=${SpeedUnit.MetersPerSecond}>m/s</ion-select-option>
              <ion-select-option value=${SpeedUnit.FeetPerMinute}>ft/min</ion-select-option>
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

  protected createRenderRoot(): Element {
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

  private async dismiss(): Promise<any> {
    const modal = await getModalController().getTop();
    await modal?.dismiss();
  }
}
