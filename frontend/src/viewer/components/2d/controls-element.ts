import '../menu-element';
import '../dashboard-element';
import '../name-element';
import './airspace-element';
import './airways-element';
import './tracking-element';
import './path-element';

import { RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { Units } from '../../logic/units';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

@customElement('controls-element')
export class ControlsElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map!: google.maps.Map;

  @state()
  private timeSec = 0;
  @state()
  private track?: RuntimeTrack;
  @state()
  private units?: Units;
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
      <airways-element .map=${this.map}></airways-element>
      <path-element .map=${this.map}></path-element>
      <tracking-element .map=${this.map}></tracking-element>
      ${this.track?.name
        ? html`
            <name-ctrl-element .name=${this.track.name} .color=${this.color} .track=${this.track}></name-ctrl-element>
          `
        : ''}
      ${this.track
        ? html`
            <dashboard-ctrl-element
              .track=${this.track}
              .timeSec=${this.timeSec}
              .units=${this.units}
            ></dashboard-ctrl-element>
          `
        : ''}
    </div>`;
  }
}
