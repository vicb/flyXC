import '@ui5/webcomponents/dist/Dialog';
import '@ui5/webcomponents/dist/Label';
import '@ui5/webcomponents/dist/Input';
import '@ui5/webcomponents/dist/Button';
import '@ui5/webcomponents/dist/Option';
import '@ui5/webcomponents/dist/Select';

import { customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { LoaderElement } from './components/loader-element';
import { MapElement } from './components/map-element';
import * as mapSel from './selectors/map';
import { RootState, store } from './store';

export { MapElement, LoaderElement };

@customElement('fly-xc')
export class FlyXc extends connect(store)(LitElement) {
  @property()
  hasTracks = false;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.hasTracks = mapSel.tracks(state.map).length > 0;
    }
  }

  render(): TemplateResult {
    const classes = ['fs-enabled'];
    if (this.hasTracks) {
      classes.push('hasTracks');
    }
    return html`
      <map-element class=${classes.join(' ')}></map-element>
      <loader-element></loader-element>
    `;
  }

  createRenderRoot(): Element {
    return this;
  }
}
