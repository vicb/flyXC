import { CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { RootState, store } from '../redux/store';
import { controlStyle } from './control-style';

@customElement('expand-ctrl-element')
export class ExpandElement extends connect(store)(LitElement) {
  @internalProperty()
  private fullscreen = true;

  private element: Element | null = null;

  stateChanged(state: RootState): void {
    this.fullscreen = state.browser.isFullscreen;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.element = document.querySelector('.fs-enabled');
  }

  static get styles(): CSSResult {
    return controlStyle;
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la ${this.fullscreen ? 'la-compress' : 'la-expand'} la-2x" @click=${this.toggleFullscreen}></i>
    `;
  }

  private toggleFullscreen(): void {
    if (this.element) {
      if (!this.fullscreen) {
        this.element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  }
}
