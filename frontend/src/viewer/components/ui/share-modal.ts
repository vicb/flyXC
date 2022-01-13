import { html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { getModalController, getToastController } from './ion-controllers';

import { toDataURL } from 'qrcode/lib/browser';
import { SegmentCustomEvent } from '@ionic/core';
import { LatLonZ } from 'flyxc/common/src/runtime-track';
import { encodeFloats, encodeSignedIntegers } from 'ol/format/Polyline';

@customElement('share-modal')
export class ShareModal extends LitElement {
  @property({ attribute: false })
  link = '';

  @property({ attribute: false })
  points: LatLonZ[] = [];

  @state()
  private type: 'task' | 'link' = 'task';

  private qrDataUrl?: string;

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('link') || changedProps.has('type')) {
      this.qrDataUrl = undefined;
      toDataURL(this.type == 'link' ? this.link : this.createXCTrackRoute()).then((url: string) => {
        this.qrDataUrl = url;
        this.requestUpdate();
      });

      changedProps.delete('link');
      changedProps.delete('type');
    }

    return super.shouldUpdate(changedProps);
  }

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

        <ion-item button target="_blank" href=${this.createXcTrackLink()} lines="full">
          <i class="las la-external-link-alt la-2x"></i>Open with XcTrack
        </ion-item>

        <ion-item lines="none">
          <ion-segment @ionChange=${this.onTypeChanged} value=${this.type}>
            <ion-segment-button value="task">
              <ion-label>Task (XCTrack)</ion-label>
            </ion-segment-button>
            <ion-segment-button value="link">
              <ion-label>Link</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item lines="full">
          ${this.qrDataUrl == null
            ? html`<ion-spinner name="dots" style="margin: 0 auto"></ion-spinner>`
            : html`<img width="200" height="200" src=${this.qrDataUrl} style="margin: 0 auto" />`}
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

  private onTypeChanged(e: SegmentCustomEvent): void {
    this.type = e.detail.value as any;
  }

  // Create a link to open XCTrack on mobile
  private createXcTrackLink(): string {
    const route = this.points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(':');
    const params = new URLSearchParams();
    params.set('route', route);
    return `http://xctrack.org/xcplanner?${params}`;
  }

  // Creates a XCTrack task QR code.
  // See https://xctrack.org/Competition_Interfaces.html#task-definition-format-2---for-qr-codes
  private createXCTrackRoute(): string {
    const turnpoints = this.points.map((tp, i) => ({
      n: `WPT ${i + 1}`,
      z: encodeFloats([tp.lon, tp.lat], 1e5) + encodeSignedIntegers([tp.alt, 400]),
    }));
    return `XCTSK:${JSON.stringify({ taskType: 'CLASSIC', version: 2, t: turnpoints })}`;
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
