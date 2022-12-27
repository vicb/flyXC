import './ui/pref-modal';

import * as common from '@flyxc/common';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { modalController } from '@ionic/core/components';

import * as units from '../logic/units';
import { controlStyle } from '../styles/control-style';

@customElement('dashboard-ctrl-element')
export class DashboardElement extends LitElement {
  @property({ attribute: false })
  timeSec = 0;
  @property({ attribute: false })
  track?: common.RuntimeTrack;
  @property({ attribute: false })
  units?: units.Units;

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
            <li>${units.formatUnit(alt, this.units.altitude)} [Alt]</li>
            <li>${units.formatUnit(Math.max(0, alt - gndAlt), this.units.altitude)} [AGL]</li>
            <li>${units.formatUnit(this.getVz(), this.units.vario)} [Vz]</li>
            <li>${units.formatUnit(this.getVx(), this.units.speed)} [Vx]</li>
            <li>${date.toLocaleTimeString()}</li>
            <li>${date.toLocaleDateString()}</li>
          </ul>
        `
      : html``;
  }

  private async handlePreferences() {
    const modal = await modalController.create({
      component: 'pref-modal',
    });
    await modal.present();
  }

  private getElevation(): number {
    if (!this.track) {
      return 0;
    }
    return common.sampleAt(this.track.timeSec, this.track.alt, this.timeSec);
  }

  private getGroundElevation(): number {
    if (this.track?.gndAlt) {
      return common.sampleAt(this.track.timeSec, this.track.gndAlt, this.timeSec);
    }
    return 0;
  }

  private getVz(): number {
    if (!this.track) {
      return 0;
    }
    return common.sampleAt(this.track.timeSec, this.track.vz, this.timeSec);
  }

  private getVx(): number {
    if (!this.track) {
      return 0;
    }
    return common.sampleAt(this.track.timeSec, this.track.vx, this.timeSec);
  }
}
