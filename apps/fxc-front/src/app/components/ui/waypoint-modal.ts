import type { LatLonAlt } from '@flyxc/common';
import { modalController } from '@ionic/core/components';
import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const WAYPOINT_FORMATS: { [id: string]: string } = {
  cup: 'See You (cup)',
  gpx: 'GPX waypoints',
  gpxRoute: 'GPX route',
  kml: 'KML (Google Earth)',
  tsk: 'XCSoar',
  wpt: 'FormatGEO (GpsDump wpt)',
  xctsk: 'XCTrack',
};

@customElement('waypoint-modal')
export class WaypointModal extends LitElement {
  @property({ attribute: false })
  points: LatLonAlt[] = [];

  @state()
  fileType = 'cup';

  @state()
  prefix = 'FXC';

  render(): TemplateResult {
    return html`
      <ion-header>
        <ion-toolbar color="light">
          <ion-title>Download the waypoints</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-item lines="full">
          <ion-select label="File type" value=${this.fileType} interface="popover" @ionChange=${this.handleFormat}>
            ${Object.getOwnPropertyNames(WAYPOINT_FORMATS).map(
              (fmt) => html`<ion-select-option value=${fmt}>${WAYPOINT_FORMATS[fmt]}</ion-select-option> `,
            )}
          </ion-select>
        </ion-item>

        <ion-item lines="full">
          <ion-input
            value=${this.prefix}
            @ionChange=${this.handlePrefix}
            label="Waypoint prefix"
            label-placement="floating"
          ></ion-input>
        </ion-item>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.handleDownload}>Download</ion-button>
          </ion-buttons>
          <ion-buttons slot="secondary">
            <ion-button @click=${this.dismiss}>Cancel</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
      <form
        id="wpt-form"
        style="display: none"
        action=${`${import.meta.env.VITE_API_SERVER}/api/waypoint/download`}
        method="POST"
      >
        <input id="request" name="request" />
      </form>
    `;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private handleFormat(e: CustomEvent) {
    this.fileType = e.detail.value;
  }

  private handlePrefix(e: CustomEvent) {
    this.prefix = e.detail.value;
  }

  private async handleDownload(): Promise<void> {
    const root = this.renderRoot;
    const form = root.querySelector('#wpt-form') as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const payload = {
      format: this.fileType,
      prefix: this.prefix,
      points: this.points,
    };
    input.value = JSON.stringify(payload);
    form.submit();
    await this.dismiss();
  }

  private async dismiss(): Promise<void> {
    const modal = await modalController.getTop();
    await modal?.dismiss();
  }
}
