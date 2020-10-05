import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { RuntimeFixes } from '../../../../common/track';
import { sampleAt } from '../logic/math';
import { formatUnit, UNITS } from '../logic/units';
import { controlStyle } from './control-style';

@customElement('dashboard-ctrl-element')
export class DashboardElement extends LitElement {
  @property()
  timestamp = 0;

  @property()
  fixes?: RuntimeFixes;

  @property()
  units?: { [type: string]: UNITS };

  static get styles(): CSSResult[] {
    return [
      controlStyle,
      css`
        h3 {
          padding: 0;
          margin: 0;
        }
        ul {
          list-style-type: none;
          margin: 0;
          padding: 0;
        }
      `,
    ];
  }

  private getElevation(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.alt, this.timestamp);
  }

  private getGroundElevation(): number {
    if (this.fixes?.gndAlt) {
      return sampleAt(this.fixes.ts, this.fixes.gndAlt, this.timestamp);
    }
    return 0;
  }

  private getVz(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.vz, this.timestamp);
  }

  private getVx(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.vx, this.timestamp);
  }

  protected render(): TemplateResult {
    const alt = this.getElevation();
    const gndAlt = this.getGroundElevation();
    return this.units
      ? html`
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
          />
          <h3><i class="la la-tachometer-alt la-2x"></i></h3>
          <ul>
            <li>${formatUnit(alt, this.units.altitude)} [alt]</li>
            <li>${formatUnit(Math.max(0, alt - gndAlt), this.units.altitude)} [gndAlt]</li>
            <li>${formatUnit(this.getVz(), this.units.vario)} [Vz]</li>
            <li>${formatUnit(this.getVx(), this.units.speed)} [Vx]</li>
            <li>${new Date(this.timestamp).toLocaleTimeString()}</li>
            <li>${new Date(this.timestamp).toLocaleDateString()}</li>
          </ul>
        `
      : html``;
  }
}
