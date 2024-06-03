import type { CSSResult, TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { controlStyle } from '../styles/control-style';

@customElement('menu-ctrl-element')
export class MenuElement extends LitElement {
  protected splitPane: HTMLIonSplitPaneElement | null = null;
  protected eventController?: AbortController;

  static get styles(): CSSResult {
    return controlStyle;
  }

  connectedCallback() {
    super.connectedCallback();
    this.eventController = new AbortController();
    this.addEventListener(
      'click',
      async () => {
        if (this.splitPane) {
          this.splitPane.when = true;
        }
      },
      { signal: this.eventController.signal },
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.eventController?.abort();
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la la-bars la-2x"></i>
    `;
  }

  protected async firstUpdated(): Promise<void> {
    this.splitPane = document.querySelector('ion-split-pane');

    if (this.splitPane) {
      this.splitPane?.addEventListener('ionSplitPaneVisible', (e) => this.setDisplay(!e.detail.visible), {
        signal: this.eventController?.signal,
      });
      this.setDisplay(!(await this.splitPane.isVisible()));
    }
  }

  protected setDisplay(display: boolean): void {
    this.style.display = display ? 'block' : 'none';
  }
}
