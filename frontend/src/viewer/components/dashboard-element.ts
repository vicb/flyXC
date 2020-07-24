import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  TemplateResult,
} from 'lit-element';

import { RuntimeFixes } from '../../../../common/track';
import { sampleAt } from '../logic/math';
import { formatUnit, UNITS } from '../logic/units';
import { controlHostStyle } from './control-style';

@customElement('dashboard-ctrl-element')
export class DashboardElement extends LitElement {
  @property()
  timestamp = 0;

  @property()
  fixes: RuntimeFixes | null = null;

  @internalProperty()
  units: { [type: string]: UNITS } | null = null;

  static get styles(): CSSResult[] {
    return [
      controlHostStyle,
      css`
        h3 {
          padding: 0 0 5px 0;
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

  protected getElevation(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.alt, [this.timestamp])[0];
  }

  protected getGroundElevation(): number {
    if (this?.fixes?.gndAlt) {
      return sampleAt(this.fixes.ts, this.fixes.gndAlt, [this.timestamp])[0];
    }
    return 0;
  }

  protected getVz(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.vz, [this.timestamp])[0];
  }

  protected getVx(): number {
    if (!this.fixes) {
      return 0;
    }
    return sampleAt(this.fixes.ts, this.fixes.vx, [this.timestamp])[0];
  }

  render(): TemplateResult {
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
