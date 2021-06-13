import { customElement, html, LitElement, property, TemplateResult } from 'lit-element';

import { getModalController, getToastController } from './ion-controllers';

@customElement('share-modal')
export class ShareModal extends LitElement {
  @property({ attribute: false })
  xctrackLink = '';

  @property({ attribute: false })
  xctsk = '';

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>Share the route</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-item button @click=${this.handleCopy} lines="full">
          <ion-label>Link</ion-label>
          <ion-input readonly value=${this.link} color="medium"></ion-input>
          <ion-label slot="end"><i class="la la-copy la-2x"></i></ion-label>
        </ion-item>

        <ion-item button target="_blank" href=${this.xctrackLink} lines="full">
          <i class="las la-external-link-alt la-2x"></i>Open with XcTrack
        </ion-item>

        <ion-item lines="full">
          <img
            width="200"
            height="200"
            src=${`_qr.svg?text=${encodeURIComponent(this.xctsk)}`}
            style="margin: 0 auto"
          />
        </ion-item>
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

  private async handleCopy() {
    await navigator.clipboard.writeText(this.link);
    const toast = await getToastController().create({
      message: 'Link copied to the clipboard',
      duration: 3000,
      buttons: [
        {
          text: 'Close',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  private async dismiss(): Promise<void> {
    const modal = await getModalController().getTop();
    await modal?.dismiss();
  }
}
