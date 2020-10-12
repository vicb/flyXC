import { extractGroupId, RuntimeTrack } from 'flyxc/common/track';
import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { Units } from '../../logic/units';
import { setDisplayNames } from '../../redux/app-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { removeTracksByGroupIds, selectNextTrack } from '../../redux/track-slice';
import { AboutElement } from '../about-element';
import { DashboardElement } from '../dashboard-element';
import { ExpandElement } from '../expand-element';
import { GlobeElement } from '../globe-element';
import { NameElement } from '../name-element';
import { PreferencesElement } from '../preferences-element';
import { UploadElement } from '../upload-element';
import { AirspaceCtrlElement } from './airspace-element';
import { AirwaysCtrlElement, AirwaysOverlay } from './airways-element';
import { PathCtrlElement } from './path-element';
import { TrackingElement } from './tracking-element';

export {
  AboutElement,
  AirspaceCtrlElement,
  AirwaysCtrlElement,
  AirwaysOverlay,
  DashboardElement,
  ExpandElement,
  GlobeElement,
  NameElement,
  PathCtrlElement,
  PreferencesElement,
  TrackingElement,
  UploadElement,
};

@customElement('controls-element')
export class ControlsElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private timestamp = 0;
  @internalProperty()
  private track?: RuntimeTrack;
  @internalProperty()
  private numTracks = 0;
  @internalProperty()
  private units?: Units;
  @internalProperty()
  private color: '';
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
      .cl {
        clear: both;
      }
    `;
  }

  protected render(): TemplateResult {
    return html`<div id="ct">
      <airspace-ctrl-element .map=${this.gMap} class="cl"></airspace-ctrl-element>
      <airways-ctrl-element .map=${this.gMap} class="cl"></airways-ctrl-element>
      <globe-element .view3d=${this.view3d} class="cl"></globe-element>
      ${this.isInIframe ? html`<expand-ctrl-element></expand-ctrl-element>` : html``}
      <path-ctrl-element .map=${this.gMap} class="cl"></path-ctrl-element>
      <upload-ctrl-element></upload-ctrl-element>
      <about-ctrl-element class="cl"></about-ctrl-element>
      <preferences-ctrl-element></preferences-ctrl-element>
      <tracking-element .map=${this.gMap} class="cl"></tracking-element>
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
              @displayNames=${this.handleDisplayNames}
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
    </div>`;
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
