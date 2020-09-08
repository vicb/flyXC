import { CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { setView3d } from '../actions';
import * as msg from '../logic/messages';
import { store } from '../store';
import { controlHostStyle } from './control-style';

@customElement('globe-element')
export class GlobeElement extends LitElement {
  @property()
  view3d = false;

  static get styles(): CSSResult[] {
    return [controlHostStyle];
  }

  protected render(): TemplateResult {
    const icon = this.view3d ? 'la-map' : 'la-globe';
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <i class=${`la la-2x ${icon}`} style="cursor: pointer" @click=${() => this.handleSwitch()}></i>
    `;
  }

  private handleSwitch(): void {
    // Request the current map to update the location.
    msg.requestLocation.emit();
    store.dispatch(setView3d(!this.view3d));
  }
}
