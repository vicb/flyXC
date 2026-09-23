import '../dashboard-element';
import '../menu-element';
import '../name-element';

import type { CSSResult, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * Top-right map controls container for the 3D Cesium/ArcGIS view.
 *
 * Hosts menu, pilot name, and flight dashboard elements.
 */
@customElement('controls3d-element')
export class Controls3dElement extends LitElement {
  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 12px 'Nobile', verdana, sans-serif;
        height: 1px;
        box-shadow: none !important;
      }
    `;
  }

  protected render(): TemplateResult {
    return html`
      <menu-ctrl-element></menu-ctrl-element>
      <name-ctrl-element></name-ctrl-element>
      <dashboard-ctrl-element></dashboard-ctrl-element>
    `;
  }
}
