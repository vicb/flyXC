import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { RuntimeFixes, RuntimeTrack } from '../../../../../common/track';
import { removeTracksById, setCurrentTrack, setDisplayNames } from '../../actions';
import { deleteUrlParamValue, ParamNames, pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { Units } from '../../reducers';
import * as sel from '../../selectors';
import { dispatch, RootState, store } from '../../store';
import { AboutElement } from '../about-element';
import { DashboardElement } from '../dashboard-element';
import { ExpandElement } from '../expand-element';
import { GlobeElement } from '../globe-element';
import { NameElement } from '../name-element';
import { UploadElement } from '../upload-element';
import { ExaggerationElement } from './exaggeration-element';

export { AboutElement, DashboardElement, GlobeElement, NameElement, UploadElement, ExpandElement, ExaggerationElement };

@customElement('controls3d-element')
export class Controls3dElement extends connect(store)(LitElement) {
  @internalProperty()
  private timestamp = 0;

  @internalProperty()
  private fixes?: RuntimeFixes;

  @internalProperty()
  private name?: string;

  @internalProperty()
  private tracks: RuntimeTrack[] = [];

  @internalProperty()
  private units?: Units;

  @internalProperty()
  private currentTrackIndex?: number;

  @internalProperty()
  private view3d = false;

  private isInIframe = true; //window.parent !== window;

  stateChanged(state: RootState): void {
    this.timestamp = state.map.ts;
    this.fixes = sel.activeFixes(state.map);
    this.name = sel.name(state.map);
    this.tracks = sel.tracks(state.map);
    this.units = state.map.units;
    this.currentTrackIndex = state.map.currentTrackIndex;
    this.view3d = state.map.view3d;
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

  // Closes the current track.
  private handleClose(): void {
    if (this.currentTrackIndex == null || this.tracks == null) {
      return;
    }
    const id = this.tracks[this.currentTrackIndex].id;
    if (id != null) {
      pushCurrentState();
      deleteUrlParamValue(ParamNames.TRACK_ID, String(id));
      dispatch(removeTracksById([id]));
      msg.tracksRemoved.emit([id]);
    }
  }

  // Activates the next track.
  private handleNext(): void {
    if (this.currentTrackIndex != null && this.tracks != null) {
      const index = (this.currentTrackIndex + 1) % this.tracks.length;
      dispatch(setCurrentTrack(index));
    }
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(e: CustomEvent): void {
    dispatch(setDisplayNames(e.detail));
  }

  protected render(): TemplateResult {
    return html`
      <globe-element .view3d=${this.view3d} class="cl"></globe-element>
      ${this.isInIframe ? html`<expand-ctrl-element></expand-ctrl-element>` : html``}
      <exaggeration-element class="cl"></exaggeration-element>
      <upload-ctrl-element class="cl"></upload-ctrl-element>
      <about-ctrl-element class="cl"></about-ctrl-element>
      <preferences-ctrl-element></preferences-ctrl-element>
      ${this.name
        ? html`
            <name-ctrl-element
              class="cl"
              .name=${this.name}
              .index=${this.currentTrackIndex}
              .nbtracks=${this.tracks?.length || 0}
              @closeActiveTrack=${this.handleClose}
              @selectNextTrack=${this.handleNext}
              @displayNames=${(e: CustomEvent) => this.handleDisplayNames(e)}
            ></name-ctrl-element>
          `
        : ''}
      ${this.fixes
        ? html`
            <dashboard-ctrl-element
              class="cl"
              .fixes=${this.fixes}
              .timestamp=${this.timestamp}
              .units=${this.units}
            ></dashboard-ctrl-element>
          `
        : ''}
    `;
  }
}
