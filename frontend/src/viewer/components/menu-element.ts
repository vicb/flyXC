import { CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { controlStyle } from '../styles/control-style';

@customElement('menu-ctrl-element')
export class MenuElement extends LitElement {
  static get styles(): CSSResult {
    return controlStyle;
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <ion-menu-toggle>
        <i class="la la-bars la-2x"></i>
      </ion-menu-toggle>
    `;
  }
}
