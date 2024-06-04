import '../dashboard-element';
import '../menu-element';
import '../name-element';
import './airspace-element';
import './path-element';
import './skyways-element';
import './tracking-element';

import type * as common from '@flyxc/common';
import type { CSSResult, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { connect } from 'pwa-helpers';

import type * as units from '../../logic/units';
import * as sel from '../../redux/selectors';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';

@customElement('controls-element')
export class ControlsElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private timeSec = 0;
  @state()
  private track?: common.RuntimeTrack;
  @state()
  private units?: units.Units;
  @state()
  private color = '';

  stateChanged(state: RootState): void {
    this.timeSec = state.app.timeSec;
    this.track = sel.currentTrack(state);
    this.units = state.units;
    if (this.track) {
      this.color = sel.trackColors(state)[this.track.id];
    }
  }

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 12px 'Nobile', verdana, sans-serif;
        height: 1px;
        margin: 3px 3px 0 0;
      }
    `;
  }

  protected render(): TemplateResult {
    return html`<div id="ct">
      <menu-ctrl-element></menu-ctrl-element>
      <airspace-element .map=${this.map}></airspace-element>
      <skyways-element .map=${this.map}></skyways-element>
      <path-element .map=${this.map}></path-element>
      <tracking-element .map=${this.map}></tracking-element>
      ${when(
        this.track?.name,
        () =>
          html`<name-ctrl-element
            .name=${this.track!.name}
            .color=${this.color}
            .track=${this.track}
          ></name-ctrl-element>`,
      )}
      ${when(
        this.track,
        () =>
          html`
            <dashboard-ctrl-element
              .track=${this.track}
              .timeSec=${this.timeSec}
              .units=${this.units}
            ></dashboard-ctrl-element>
          `,
      )}
    </div>`;
  }
}
