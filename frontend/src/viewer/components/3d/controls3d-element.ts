import '../about-element';
import '../dashboard-element';
import '../expand-element';
import '../globe-element';
import '../name-element';
import '../upload-element';
import './exaggeration-element';
import './tracking3d-element';

import { extractGroupId, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { Units } from '../../logic/units';
import { setDisplayNames } from '../../redux/app-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { removeTracksByGroupIds, selectNextTrack } from '../../redux/track-slice';

@customElement('controls3d-element')
export class Controls3dElement extends connect(store)(LitElement) {
  @internalProperty()
  private timestamp = 0;
  @internalProperty()
  private track?: RuntimeTrack;
  @internalProperty()
  private numTracks = 0;
  @internalProperty()
  private units?: Units;
  @internalProperty()
  private color = '';
  @internalProperty()
  private view3d = false;
  @internalProperty()
  private displayName = false;

  private readonly isInIframe = store.getState().browser.isInIframe;

  stateChanged(state: RootState): void {
    this.timestamp = state.app.timestamp;
    this.track = sel.currentTrack(state);
    this.numTracks = sel.numTracks(state);
    this.units = state.units;
    this.view3d = state.app.view3d;
    this.displayName = state.app.displayNames;
    this.color = sel.trackColors(state)[this.track?.id ?? 0];
  }

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 12px 'Nobile', verdana, sans-serif;
        height: 1px;
        box-shadow: none !important;
      }
      .cl {
        clear: both;
      }
    `;
  }

  protected render(): TemplateResult {
    return html`
      <globe-element .view3d=${this.view3d} class="cl"></globe-element>
      ${this.isInIframe ? html`<expand-ctrl-element title="full screen"></expand-ctrl-element>` : html``}
      <exaggeration-element class="cl" title="altitude exaggeration"></exaggeration-element>
      <upload-ctrl-element class="cl" title="upload tracks"></upload-ctrl-element>
      <about-ctrl-element class="cl" title="about"></about-ctrl-element>
      <preferences-ctrl-element title="settings"></preferences-ctrl-element>
      <tracking3d-element class="cl" title="live tracking"></tracking3d-element>
      ${this.track?.name
        ? html`
            <name-ctrl-element
              class="cl"
              .name=${this.track.name}
              .color=${this.color}
              .numtracks=${this.numTracks}
              .displayNames=${this.displayName}
              @closeActiveTrack=${this.handleClose}
              @selectNextTrack=${this.handleNext}
              @displayNames=${(e: CustomEvent) => this.handleDisplayNames(e)}
            ></name-ctrl-element>
          `
        : ''}
      ${this.track
        ? html`
            <dashboard-ctrl-element
              class="cl"
              .track=${this.track}
              .timestamp=${this.timestamp}
              .units=${this.units}
            ></dashboard-ctrl-element>
          `
        : ''}
    `;
  }

  // Closes the current track.
  private handleClose(): void {
    if (this.track == null) {
      return;
    }
    pushCurrentState();
    const groupId = extractGroupId(this.track.id);
    store.dispatch(removeTracksByGroupIds([groupId]));
    msg.trackGroupsRemoved.emit([groupId]);
  }

  // Activates the next track.
  private handleNext(): void {
    store.dispatch(selectNextTrack());
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(e: CustomEvent): void {
    store.dispatch(setDisplayNames(e.detail));
  }
}
