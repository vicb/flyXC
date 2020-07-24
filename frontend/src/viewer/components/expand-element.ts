import { CSSResult, customElement, html, internalProperty, LitElement, property, TemplateResult } from 'lit-element';

import { controlHostStyle } from './control-style';

@customElement('expand-ctrl-element')
export class ExpandElement extends LitElement {
  @internalProperty()
  expanded = false;

  @property()
  map: google.maps.Map | null = null;

  element: Element | null = null;

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
      // Switch back to 'auto' when full screen is exited by pressing the ESC key.
      this.map?.setOptions({ gestureHandling: document.fullscreenElement ? 'greedy' : 'auto' });
    });
  }

  static get styles(): CSSResult {
    return controlHostStyle;
  }

  protected toggleExpand(): void {
    this.expanded = !this.expanded;
    if (this.element) {
      if (this.expanded) {
        this.element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
    // In full screen mode the gesture handling must be greedy.
    // Using ctrl (+ scroll) is unnecessary as thr page can not scroll anyway.
    this.map?.setOptions({ gestureHandling: this.expanded ? 'greedy' : 'auto' });
  }

  render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class="la ${this.expanded ? 'la-compress' : 'la-expand'} la-2x" @click=${this.toggleExpand}></i>
    `;
  }
}
