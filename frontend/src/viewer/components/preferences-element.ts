import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LEAGUES } from '../logic/score/league/leagues';
import { DistanceUnit, SpeedUnit, Units } from '../logic/units';
import { setLeague } from '../redux/planner-slice';
import { RootState, store } from '../redux/store';
import { setAltitudeUnit, setDistanceUnit, setSpeedUnit, setVarioUnit } from '../redux/units-slice';
import { controlStyle } from '../styles/control-style';

@customElement('preferences-ctrl-element')
export class PreferencesElement extends connect(store)(LitElement) {
  @property()
  league = 'xc';
  @property({ attribute: false })
  units?: Units;

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

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        .form-fields {
          display: grid;
          grid-template-columns: max-content max-content;
          grid-gap: 5px;
        }
        .form-fields ui5-label {
          align-self: center;
        }
        .form-fields ui5-select {
          width: 100%;
        }
        ui5-select[id='league'] {
          min-width: 300px;
        }
      `,
    ];
  }

  protected render(): TemplateResult {
    return this.units
      ? html`
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
          />
          <i class="la la-cog la-2x" style="cursor: pointer" @click=${this.openDialog}></i>
          <ui5-dialog id="pref-dialog" header-text="Preferences">
            <section class="form-fields">
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
              <ui5-label for="distance">Distance</ui5-label>
              <ui5-select
                id="distance"
                @change=${(e: any) => store.dispatch(setDistanceUnit(e.target.selectedOption.value))}
              >
                <ui5-option value=${DistanceUnit.Kilometers} ?selected=${this.units.distance == DistanceUnit.Kilometers}
                  >kilometers</ui5-option
                >
                <ui5-option value=${DistanceUnit.Miles} ?selected=${this.units.distance == DistanceUnit.Miles}
                  >miles</ui5-option
                >
              </ui5-select>
              <ui5-label for="speed">Speed</ui5-label>
              <ui5-select id="speed" @change=${(e: any) => store.dispatch(setSpeedUnit(e.target.selectedOption.value))}>
                <ui5-option
                  value=${SpeedUnit.KilometersPerHour}
                  ?selected=${this.units.speed == SpeedUnit.KilometersPerHour}
                  >km/h</ui5-option
                >
                <ui5-option value=${SpeedUnit.MilesPerHour} ?selected=${this.units.speed == SpeedUnit.MilesPerHour}
                  >mi/h</ui5-option
                >
              </ui5-select>
              <ui5-label for="altitude">Altitude</ui5-label>
              <ui5-select
                id="altitude"
                @change=${(e: any) => store.dispatch(setAltitudeUnit(e.target.selectedOption.value))}
              >
                <ui5-option value=${DistanceUnit.Meters} ?selected=${this.units.altitude == DistanceUnit.Meters}
                  >meters</ui5-option
                >
                <ui5-option value=${DistanceUnit.Feet} ?selected=${this.units.altitude == DistanceUnit.Feet}
                  >feet</ui5-option
                >
              </ui5-select>
              <ui5-label for="vario">Vario</ui5-label>
              <ui5-select id="vario" @change=${(e: any) => store.dispatch(setVarioUnit(e.target.selectedOption.value))}>
                <ui5-option
                  value=${SpeedUnit.MetersPerSecond}
                  ?selected=${this.units.vario == SpeedUnit.MetersPerSecond}
                  >m/s</ui5-option
                >
                <ui5-option value=${SpeedUnit.FeetPerMinute} ?selected=${this.units.vario == SpeedUnit.FeetPerMinute}
                  >ft/min</ui5-option
                >
              </ui5-select>
            </section>
            <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
              <div style="flex: 1"></div>
              <ui5-button design="Emphasized" @click=${this.closeDialog}>Close</ui5-button>
            </div>
          </ui5-dialog>
        `
      : html``;
  }

  private openDialog(): void {
    const dialog = this.renderRoot.querySelector('#pref-dialog') as any;
    dialog.open();
  }

  private closeDialog(): void {
    const dialog = this.renderRoot.querySelector('#pref-dialog') as any;
    dialog.close();
  }
}
