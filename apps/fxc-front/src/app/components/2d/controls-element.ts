import '../dashboard-element';
import '../menu-element';
import '../name-element';
import './airspace-element';
import './path-element';
import './skyways-element';
import './tracking-element';

import type { CSSResult, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Map controls container for the 2D Google Maps view.
 *
 * Hosts menu, airspace, skyways, path, live tracking, pilot name, and flight dashboard elements.
 */
@customElement('controls-element')
export class ControlsElement extends LitElement {
  @property({ attribute: false })
  map!: google.maps.Map;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 12px 'Nobile', verdana, sans-serif;
        height: 1px;
        margin: 3px 3px 0 0;
      }
    `;
  }

  protected render(): TemplateResult {
    return html`<div id="ct">
      <menu-ctrl-element></menu-ctrl-element>
      <airspace-element .map=${this.map}></airspace-element>
      <skyways-element .map=${this.map}></skyways-element>
      <path-element .map=${this.map}></path-element>
      <tracking-element .map=${this.map}></tracking-element>
      <name-ctrl-element></name-ctrl-element>
      <dashboard-ctrl-element></dashboard-ctrl-element>
    </div>`;
  }
}
