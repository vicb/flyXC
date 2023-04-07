import { html, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import { modalController } from '@ionic/core/components';

// @ts-expect-error
const BUILD: string = __BUILD_TIMESTAMP__;

@customElement('about-modal')
export class AboutModal extends LitElement {
  render(): TemplateResult {
    return html`<ion-header>
        <ion-toolbar color="light">
          <ion-title>About flyXC.app</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <p>
          FlyXC by <a href="https://github.com/vicb" target="_blank">Victor Berchet</a>,
          <a href="https://github.com/mmomtchev" target="_blank">Momtchil Momtchev</a>,
          <a href="https://github.com/osmeras" target="_blank">Stanislav Ošmera</a>
        </p>

        <p>
          Please report any issue on
          <a href="https://github.com/vicb/flyxc/issues" target="_blank">
            <i class="lab la-github-square"></i>github
          </a>
        </p>

        <p><a href="mailto:contact@flyxc.app?subject=FlyXC" target="_blank">Contact us by email.</a></p>

        <ion-text color="medium">
          <p><em>build ${BUILD}</em></p>
        </ion-text>

        <ion-text>
          <p>Credits:</p>
          <ul class="credits">
            <li>Airspace data from <a href="https://www.openaip.net/" target="_blank">openaip</a></li>
            <li>Thermal data from <a href="https://thermal.kk7.ch/" target="_blank">Michael von Kanel</a></li>
            <li><a href="https://js.arcgis.com/" target="_blank">JS Arcgis API</a></li>
            <li><a href="https://ionicframework.com/" target="_blank">Ionic</a></li>
            <li><a href="https://icons8.com/" target="_blank">Line Awesome</a></li>
            <li>and many more open source libraries, projects, and art works</li>
          </ul>
        </ion-text>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.dismiss}>Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer> `;
  }

  protected createRenderRoot(): Element {
    return this;
  }

  private async dismiss(): Promise<void> {
    const modal = await modalController.getTop();
    await modal?.dismiss();
  }
}
