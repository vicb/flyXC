import './ui/live-modal';
import './ui/track-modal';

import { modalController } from '@ionic/core/components';
import type { CSSResult, TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import * as sel from '../redux/selectors';
import type { RootState } from '../redux/store';
import { store } from '../redux/store';
import { controlStyle } from '../styles/control-style';

/**
 * Map control element displaying the active pilot's name and track color.
 *
 * Automatically connects to Redux to select either the active live pilot or runtime track pilot.
 * Clicking the control opens `<live-modal>` if a live track is selected, or `<track-modal>` if a
 * runtime track is active.
 */
@customElement('name-ctrl-element')
export class NameElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  name?: string;
  @property({ attribute: false })
  color?: string;
  @property({ type: Boolean })
  isLive?: boolean;
  @property({ type: Boolean })
  hasTrack?: boolean;

  @state()
  private stateName = '';
  @state()
  private stateColor = 'black';
  @state()
  private stateIsLive = false;
  @state()
  private stateHasTrack = false;

  /**
   * Updates component state from the Redux store.
   *
   * @param state - The current root state of the Redux store.
   */
  stateChanged(state: RootState): void {
    this.stateHasTrack = sel.hasActiveTrack(state);
    this.stateName = sel.activePilotName(state) ?? '';
    this.stateColor = sel.activePilotColor(state);
    this.stateIsLive = sel.isLiveTrackSelected(state);
  }

  static get styles(): CSSResult {
    return controlStyle;
  }

  protected render(): TemplateResult {
    const name = this.name ?? this.stateName;
    const color = this.color ?? this.stateColor;
    const hasTrack = this.hasTrack ?? this.stateHasTrack;

    // Toggle host visibility so controlStyle border and background are hidden
    // when either hasTrack or name is missing.
    const isVisible = Boolean(hasTrack && name);
    this.hidden = !isVisible;
    this.style.display = isVisible ? 'block' : 'none';

    if (!isVisible) {
      return html``;
    }

    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div style="cursor: pointer" @click=${this.handleSelect}>
        <i class="las la-user-astronaut la-2x" style=${`color: ${color};`}></i>
        ${name}
      </div>
    `;
  }

  /**
   * Opens either the live track modal or the runtime track modal depending on the active track type.
   */
  private async handleSelect(): Promise<void> {
    const isLive = this.isLive ?? this.stateIsLive;
    const modal = await modalController.create({
      component: isLive ? 'live-modal' : 'track-modal',
    });
    await modal.present();
  }
}
