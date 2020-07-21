import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { trackColor } from '../logic/map';

@customElement('name-ctrl-element')
export class NameElement extends LitElement {
  @property()
  name: string | null = null;

  @property()
  index: number | null = null;

  @property()
  displayNames = false;

  @property()
  // Total number of tracks.
  // Display a "next" button when multiple tracks are loaded.
  nbtracks = 0;

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
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <label
        ><input type="checkbox" ?checked=${this.displayNames} @change=${this.handleDisplayNames} /><i
          class="la la-user-tag la-2x"
        ></i
      ></label>
      ${this.name}
      <i class="la la-user la-2x" style=${`color: ${trackColor(this.index || 0)};`}></i>
      ${this.nbtracks > 1
        ? html`<i class="la la-chevron-right la-2x" style="cursor: pointer" @click=${this.handleNext}></i>`
        : html``}
      <i class="la la-times-circle la-2x" style="cursor: pointer" @click=${this.handleClose}></i>
    `;
  }

  protected handleClose(): void {
    this.dispatchEvent(new CustomEvent('closeActiveTrack'));
  }

  protected handleNext(): void {
    this.dispatchEvent(new CustomEvent('selectNextTrack'));
  }

  protected handleDisplayNames(e: Event): void {
    const show = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent('displayNames', { detail: show }));
  }
}
