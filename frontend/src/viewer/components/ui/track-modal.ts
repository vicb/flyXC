import { extractGroupId, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { connect } from 'pwa-helpers';

import { menuController, modalController } from '@ionic/core';

import { pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';
import { removeTracksByGroupIds, setCurrentTrackId } from '../../redux/track-slice';

@customElement('track-modal')
export class TrackModal extends connect(store)(LitElement) {
  @internalProperty()
  private tracks: RuntimeTrack[] = [];
  @internalProperty()
  private currentTrackId?: string;
  private state!: RootState;

  stateChanged(state: RootState): void {
    this.currentTrackId = state.track.currentTrackId;
    this.tracks = sel.tracks(state);
    this.state = state;
  }

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>Select / Close</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list>
          ${this.tracks.map(
            (track: RuntimeTrack) =>
              html`<ion-item
                button
                color=${track.id == this.currentTrackId ? 'primary' : ''}
                @click=${() => this.handleSelect(track)}
              >
                <i class="las la-user-astronaut la-2x" style=${`color: ${sel.trackColors(this.state)[track.id]}`}></i
                >${track.name}
                <i
                  slot="end"
                  title="close"
                  class="la la-times-circle la-2x"
                  style="cursor:pointer"
                  @click=${(e: Event) => this.handleClose(e, track)}
                ></i>
              </ion-item>`,
          )}
        </ion-list>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.dismiss}>Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    `;
  }

  protected createRenderRoot(): Element {
    return this;
  }

  private handleClose(e: Event, track: RuntimeTrack) {
    e.preventDefault();
    e.stopPropagation();
    pushCurrentState();
    const groupId = extractGroupId(track.id);
    store.dispatch(removeTracksByGroupIds([groupId]));
    msg.trackGroupsRemoved.emit([groupId]);
  }

  private handleSelect(track: RuntimeTrack) {
    store.dispatch(setCurrentTrackId(track.id));
    this.dismiss();
    menuController.close();
  }

  private async dismiss(): Promise<void> {
    const modal = await modalController.getTop();
    modal?.dismiss({
      dismissed: true,
    });
  }
}
