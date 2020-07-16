import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { setAltitudeUnit, setDistanceUnit, setLeague, setSpeedUnit, setVarioUnit } from '../actions/map';
import { LEAGUES } from '../logic/score/league/leagues';
import { UNITS } from '../logic/units';
import { Units } from '../reducers/map';
import { RootState, store } from '../store';

@customElement('preferences-ctrl-element')
export class PreferencesElement extends connect(store)(LitElement) {
  @property()
  league = 'xc';

  @property()
  units: Units | null = null;

  leagues: { value: string; name: string }[] = [];

  constructor() {
    super();
    Object.getOwnPropertyNames(LEAGUES).forEach((value) => {
      this.leagues.push({ value, name: LEAGUES[value].name });
    });
    this.leagues.sort((a, b) => (a < b ? -1 : 1));
  }

  stateChanged(state: RootState): void {
    if (state.map) {
      this.league = state.map.league;
      this.units = state.map.units;
    }
  }

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 5px;
          background-color: #adff2f;
          text-align: right;
          border-radius: 4px;
          opacity: 0.9;
          user-select: none;
          float: right;
          clear: both;
        }
        .form-fields {
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: flex-start;
          text-align: left;
          margin: 1rem;
        }
        ui5-select[id='league'] {
          min-width: 300px;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return this.units
      ? html`
          <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
          <i class="fas fa-wrench fa-2x" style="cursor: pointer" @click=${this.openDialog}></i>
          <ui5-dialog id="pref-dialog" header-text="Preferences">
            <section class="form-fields">
              <div>
                <ui5-label for="league">League</ui5-label>
                <ui5-select id="league" @change=${(e: any) => store.dispatch(setLeague(e.target.selectedOption.value))}>
                  ${this.leagues.map(
                    (league) =>
                      html`
                        <ui5-option value=${league.value} ?selected=${this.league == league.value}
                          >${league.name}</ui5-option
                        >
                      `,
                  )}
                </ui5-select>
              </div>
              <div>
                <ui5-label for="distance">Distance</ui5-label>
                <ui5-select
                  id="distance"
                  @change=${(e: any) => store.dispatch(setDistanceUnit(e.target.selectedOption.value))}
                >
                  <ui5-option value=${UNITS.kilometers} ?selected=${this.units.distance == UNITS.kilometers}
                    >kilometers</ui5-option
                  >
                  <ui5-option value=${UNITS.miles} ?selected=${this.units.distance == UNITS.miles}>miles</ui5-option>
                </ui5-select>
              </div>
              <div>
                <ui5-label for="speed">Speed</ui5-label>
                <ui5-select
                  id="speed"
                  @change=${(e: any) => store.dispatch(setSpeedUnit(e.target.selectedOption.value))}
                >
                  <ui5-option value=${UNITS.kilometers_hour} ?selected=${this.units.speed == UNITS.kilometers_hour}
                    >km/h</ui5-option
                  >
                  <ui5-option value=${UNITS.miles_hour} ?selected=${this.units.speed == UNITS.miles_hour}
                    >mi/h</ui5-option
                  >
                </ui5-select>
              </div>
              <div>
                <ui5-label for="altitude">Altitude</ui5-label>
                <ui5-select
                  id="altitude"
                  @change=${(e: any) => store.dispatch(setAltitudeUnit(e.target.selectedOption.value))}
                >
                  <ui5-option value=${UNITS.meters} ?selected=${this.units.altitude == UNITS.meters}>meters</ui5-option>
                  <ui5-option value=${UNITS.feet} ?selected=${this.units.altitude == UNITS.feet}>feet</ui5-option>
                </ui5-select>
              </div>
              <div>
                <ui5-label for="vario">Vario</ui5-label>
                <ui5-select
                  id="vario"
                  @change=${(e: any) => store.dispatch(setVarioUnit(e.target.selectedOption.value))}
                >
                  <ui5-option value=${UNITS.meters_second} ?selected=${this.units.vario == UNITS.meters_second}
                    >m/s</ui5-option
                  >
                  <ui5-option value=${UNITS.feet_minute} ?selected=${this.units.vario == UNITS.feet_minute}
                    >ft/min</ui5-option
                  >
                </ui5-select>
              </div>
            </section>
            <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
              <div style="flex: 1"></div>
              <ui5-button design="Emphasized" @click=${this.closeDialog}>Close</ui5-button>
            </div>
          </ui5-dialog>
        `
      : html``;
  }

  protected openDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('pref-dialog') as any;
    dialog.open();
  }

  protected closeDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('pref-dialog') as any;
    dialog.close();
  }
}
