import { modalController } from '@ionic/core/components';
import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('supporter-modal')
export class SupporterModal extends LitElement {
  render(): TemplateResult {
    return html`<ion-header>
        <ion-toolbar color="light">
          <ion-title>Support flyXC.app</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-text color="dark">
          <p>
            flyXC (formerly VisuGps) has always been
            <a href="https://github.com/vicb/visugps" target="_blank">open-source</a> and free to use since 2007.
          </p>
          <p>
            The development effort represents hundreds of hours per year and hosting flyXC costs around $10 a month.
          </p>
          <p>
            If you can afford it, please consider supporting flyXC with a small donation by clicking the button below.
            It will help keep the contributors motivated to maintain and improve it.
          </p>
        </ion-text>

        <a href="https://www.buymeacoffee.com/vic.b" target="_blank"
          ><img
            src="https://cdn.buymeacoffee.com/buttons/default-orange.png"
            alt="Buy Me A Coffee"
            height="41"
            width="174"
        /></a>
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
