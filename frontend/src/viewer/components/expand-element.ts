import { CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';

import * as act from '../actions';
import { dispatch } from '../store';
import { controlHostStyle } from './control-style';

@customElement('expand-ctrl-element')
export class ExpandElement extends LitElement {
  @internalProperty()
  private expanded = false;

  private element?: Element;

  constructor() {
    super();
    const fs = document.getElementsByClassName('fs-enabled');
    if (fs?.length) {
      const el = (this.element = fs[0]);
      el.addEventListener('fullscreenchange', () => {
        this.expanded = document.fullscreenElement != null;
      });
    }
    window.addEventListener('fullscreenchange', () => {
      // Handle when full screen is exited by pressing the ESC key.
      dispatch(act.setFullscreen(document.fullscreenElement != null));
    });
  }

  static get styles(): CSSResult {
    return controlHostStyle;
  }

  private toggleExpand(): void {
    this.expanded = !this.expanded;
    if (this.element) {
      if (this.expanded) {
        this.element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
    dispatch(act.setFullscreen(this.expanded));
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la ${this.expanded ? 'la-compress' : 'la-expand'} la-2x" @click=${this.toggleExpand}></i>
    `;
  }
}
