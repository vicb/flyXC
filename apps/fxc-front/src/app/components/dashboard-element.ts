import './ui/pref-modal';

import { modalController } from '@ionic/core/components';
import type { CSSResult, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import * as units from '../logic/units';
import * as sel from '../redux/selectors';
import type { RootState } from '../redux/store';
import { store } from '../redux/store';
import { controlStyle } from '../styles/control-style';

/**
 * Presentational component displaying the flight dashboard metrics (Alt, AGL, Vz, Vx, time, date).
 *
 * Driven entirely by input properties without direct store connection. Metrics that are
 * undefined (such as Vz and Vx for live tracks) are omitted from display. Clicking the
 * dashboard opens `<pref-modal>` to adjust unit preferences.
 */
@customElement('dashboard-element')
export class DashboardElement extends LitElement {
  @property({ attribute: false })
  data?: sel.ActiveDashboardData;
  @property({ attribute: false })
  alt?: number;
  @property({ attribute: false })
  gndAlt?: number;
  @property({ attribute: false })
  vz?: number;
  @property({ attribute: false })
  vx?: number;
  @property({ attribute: false })
  timeSec?: number;
  @property({ attribute: false })
  units?: units.Units;
  @property({ type: Boolean })
  hasTrack?: boolean;

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        ul {
          list-style-type: none;
          margin: 0;
          padding: 0;
        }
      `,
    ];
  }

  protected render(): TemplateResult {
    // Resolve metrics from either a bundled ActiveDashboardData object or individual properties.
    const hasTrack = this.data ? this.data.hasTrack : this.hasTrack ?? true;
    const currentUnits = this.units;
    const isVisible = Boolean(hasTrack && currentUnits);
    this.hidden = !isVisible;
    this.style.display = isVisible ? 'block' : 'none';

    if (!isVisible || !currentUnits) {
      return html``;
    }

    const alt = this.data ? this.data.alt : this.alt ?? 0;
    const gndAlt = this.data ? this.data.gndAlt : this.gndAlt;
    const vz = this.data ? this.data.vz : this.vz;
    const vx = this.data ? this.data.vx : this.vx;
    const timeSec = this.data ? this.data.timeSec : this.timeSec ?? 0;
    const date = new Date(timeSec * 1000);

    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <ul style="cursor: pointer" @click=${this.handlePreferences}>
        <li>${units.formatUnit(alt, currentUnits.altitude)} [Alt]</li>
        ${when(
          gndAlt != null,
          () => html`<li>${units.formatUnit(Math.max(0, alt - gndAlt!), currentUnits.altitude)} [AGL]</li>`,
        )}
        ${when(vz != null, () => html`<li>${units.formatUnit(vz!, currentUnits.vario)} [Vz]</li>`)}
        ${when(vx != null, () => html`<li>${units.formatUnit(vx!, currentUnits.speed)} [Vx]</li>`)}
        <li>${date.toLocaleTimeString()}</li>
        <li>${date.toLocaleDateString()}</li>
      </ul>
    `;
  }

  /**
   * Opens the user preferences modal to customize unit display.
   */
  private async handlePreferences(): Promise<void> {
    const modal = await modalController.create({
      component: 'pref-modal',
    });
    await modal.present();
  }
}

/**
 * Map control element connected to Redux that passes the active flight telemetry
 * down to the presentational `<dashboard-element>`.
 */
@customElement('dashboard-ctrl-element')
export class DashboardCtrlElement extends connect(store)(LitElement) {
  @state()
  private data?: sel.ActiveDashboardData;
  @state()
  private units?: units.Units;

  /**
   * Updates component telemetry values and unit preferences from the Redux store.
   *
   * @param state - The current root state of the Redux store.
   */
  stateChanged(state: RootState): void {
    this.units = state.units;
    this.data = sel.activeDashboardData(state);
  }

  protected render(): TemplateResult {
    if (!this.data?.hasTrack || !this.units) {
      return html``;
    }
    return html`<dashboard-element .data=${this.data} .units=${this.units}></dashboard-element>`;
  }
}
