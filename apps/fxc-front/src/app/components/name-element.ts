import './ui/track-modal';

import type * as common from '@flyxc/common';
import type { CSSResult, TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { modalController } from '@ionic/core/components';

import { controlStyle } from '../styles/control-style';

@customElement('name-ctrl-element')
export class NameElement extends LitElement {
  @property({ attribute: false })
  name = '';
  @property({ attribute: false })
  color = 'black';
  @property({ attribute: false })
  track?: common.RuntimeTrack;

  static get styles(): CSSResult {
    return controlStyle;
  }

  protected render(): TemplateResult {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div style="cursor: pointer" @click=${this.handleSelect}>
        <i class="las la-user-astronaut la-2x" style=${`color: ${this.color};`}></i>
        ${this.name}
      </div>
    `;
  }

  // Activates the next track.
  private async handleSelect() {
    const modal = await modalController.create({
      component: 'track-modal',
    });
    await modal.present();
  }
}
