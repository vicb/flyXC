import { CSSResult, LitElement, TemplateResult, css, customElement, html, property } from 'lit-element';

import { trackColor } from '../logic/map';

@customElement('name-ctrl-element')
export class NameElement extends LitElement {
  @property()
  name: string | null = null;

  @property()
  index: number | null = null;

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
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      ${this.name}
      <i class="fas fa-user fa-2x" style=${`color: ${trackColor(this.index || 0)};`}></i>
      <i class="fas fa-times-circle fa-2x" style="cursor: pointer" @click=${this.handleClose}></i>
    `;
  }

  protected handleClose(): void {
    this.dispatchEvent(new CustomEvent('closeActiveTrack'));
  }
}
