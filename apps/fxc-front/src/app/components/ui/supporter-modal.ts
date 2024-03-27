import { html, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { modalController } from '@ionic/core/components';
import { fetchResponse } from '@flyxc/common';

@customElement('supporter-modal')
export class SupporterModal extends LitElement {
  private supporters = { names: [], amount: 0, number: 0 };

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    try {
      const response = await fetchResponse('/api/supporters.json');
      if (response.ok) {
        this.supporters = await response.json();
        this.requestUpdate();
      }
    } catch (e) {
      // do nothing
    }
  }

  render(): TemplateResult {
    return html`<ion-header>
        <ion-toolbar color="light">
          <ion-title>Support flyxc.app</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-text color="dark">
          <p>
            flyxc (formerly VisuGps) has always been
            <a href="https://github.com/vicb/visugps" target="_blank">open-source</a> and free to use since 2007.
          </p>
          <p>The development effort represents hundreds of hours per year and hosting flyxc cost about $10 a month.</p>
          <p>
            If you can afford it, please consider supporting flyxc with a small donation by clicking the button below.
            It will help keep me motivated to maintain and improve it.
          </p>
        </ion-text>

        <a href="https://www.buymeacoffee.com/vic.b" target="_blank"
          ><img
            src="https://cdn.buymeacoffee.com/buttons/default-orange.png"
            alt="Buy Me A Coffee"
            height="41"
            width="174"
        /></a>

        <p>
          <ion-text color="dark"
            >Thanks to the ${this.supporters.number} supporters who have contributed a total of
            $${this.supporters.amount}:
            <ul>
              ${this.supporters.names.map((n) => html`<li>${n}</li>`)}
            </ul>
          </ion-text>
        </p>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.dismiss}>Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>`;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private async dismiss(): Promise<void> {
    const modal = await modalController.getTop();
    await modal?.dismiss();
  }
}
