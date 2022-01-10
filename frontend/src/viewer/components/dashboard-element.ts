import './ui/pref-modal';

import { sampleAt } from 'flyxc/common/src/math';
import { RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { formatUnit, Units } from '../logic/units';
import { controlStyle } from '../styles/control-style';
import { getModalController } from './ui/ion-controllers';

@customElement('dashboard-ctrl-element')
export class DashboardElement extends LitElement {
  @property({ attribute: false })
  timeSec = 0;
  @property({ attribute: false })
  track?: RuntimeTrack;
  @property({ attribute: false })
  units?: Units;

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
    const alt = this.getElevation();
    const gndAlt = this.getGroundElevation();
    const date = new Date(this.timeSec * 1000);
    return this.units
      ? html`
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
          />
          <ul style="cursor: pointer" @click=${this.handlePreferences}>
            <li>${formatUnit(alt, this.units.altitude)} [Alt]</li>
            <li>${formatUnit(Math.max(0, alt - gndAlt), this.units.altitude)} [AGL]</li>
            <li>${formatUnit(this.getVz(), this.units.vario)} [Vz]</li>
            <li>${formatUnit(this.getVx(), this.units.speed)} [Vx]</li>
            <li>${date.toLocaleTimeString()}</li>
            <li>${date.toLocaleDateString()}</li>
          </ul>
        `
      : html``;
  }

  private async handlePreferences() {
    const modal = await getModalController().create({
      component: 'pref-modal',
    });
    await modal.present();
  }

  private getElevation(): number {
    if (!this.track) {
      return 0;
    }
    return sampleAt(this.track.timeSec, this.track.alt, this.timeSec);
  }

  private getGroundElevation(): number {
    if (this.track?.gndAlt) {
      return sampleAt(this.track.timeSec, this.track.gndAlt, this.timeSec);
    }
    return 0;
  }

  private getVz(): number {
    if (!this.track) {
      return 0;
    }
    return sampleAt(this.track.timeSec, this.track.vz, this.timeSec);
  }

  private getVx(): number {
    if (!this.track) {
      return 0;
    }
    return sampleAt(this.track.timeSec, this.track.vx, this.timeSec);
  }
}
