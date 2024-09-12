// Live tracker configuration.
import '../components/ui/google-btn';
import './admin-elements';

import { AccountFormModel, fetchResponse } from '@flyxc/common';
import { alertController } from '@ionic/core/components';
import { Binder, field } from '@vaadin/dom';
import type { TemplateResult } from 'lit';
import { html, LitElement } from 'lit';
import { customElement, queryAll, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { setFetchMillis } from '../redux/live-track-slice';
import type { TrackerPanel } from './admin-elements';

@customElement('settings-page')
export class SettingsPage extends LitElement {
  @state()
  private isLoading = true;
  @state()
  private isSubmitting = false;
  @state()
  private loggedIn = false;

  private xsrfToken = '';

  // Remove the zoleo event listener.
  private zoleoEventAbortController?: AbortController;
  // Zoleo alert dialog.
  private zoleoAlert?: HTMLIonAlertElement;

  @queryAll('device-card')
  private trackerPanels?: NodeListOf<TrackerPanel>;

  // Make sure to refresh the components when the form data are updated.
  private binder = new Binder(this, AccountFormModel, {
    onChange: () => {
      this.requestUpdate();
      if (this.trackerPanels) {
        for (let i = 0; i < this.trackerPanels.length; i++) {
          this.trackerPanels[i].requestUpdate();
        }
      }
    },
  });

  // null for own account, id for admin edits.
  _accountId: string | null = null;

  // Wait to know what account to edit to fetch.
  set accountId(id: string | null) {
    this._accountId = id;
    fetch(this.getAction(), { credentials: 'include' })
      .then((response) => {
        this.isLoading = false;
        this.xsrfToken = response.headers.get('xsrf-token') ?? '';
        return response.ok ? response.json() : null;
      })
      .then((account) => {
        if (account != null) {
          this.loggedIn = true;
          this.binder.read(account);
        }
      });
  }

  get accountId(): string | null {
    return this._accountId;
  }

  render(): TemplateResult {
    let content: TemplateResult;

    if (this.isLoading || this.isSubmitting) {
      content = html`<ion-content class="ion-padding">
        <ion-progress-bar type="indeterminate"></ion-progress-bar>
      </ion-content>`;
    } else if (this.loggedIn) {
      content = this.renderForm();
    } else {
      content = this.renderLogin();
    }

    return html`
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Live tracking</ion-title>
          <ion-title size="small">Devices setup</ion-title>
        </ion-toolbar>
      </ion-header>
      ${content}
    `;
  }

  private renderForm(): TemplateResult {
    const model = this.binder.model;

    return html`
      <ion-content>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
        />
        <style>
          .block {
            display: block;
          }
        </style>
        <ion-grid>
          <ion-row>
            <ion-col size="12" size-lg="6">
              <ion-card class="ion-padding-bottom">
                <ion-card-header color="secondary">
                  <ion-card-title><i class="las la-user-cog"></i> General</ion-card-title>
                </ion-card-header>
                <flow-ion-check
                  label="Tracking is enabled. Your live positions will be displayed on the map for up to 24h."
                  labelOff="Tracking is disabled. You will not appear on the map."
                  ...=${field(model.enabled)}
                ></flow-ion-check>
                <flow-ion-input label="Your name as displayed on the map" ...=${field(model.name)}> </flow-ion-input>
                <flow-ion-check
                  label="Share my positions across flyXC live tracking providers (Only used by FlyMe at the moment)"
                  ...=${field(model.share)}
                ></flow-ion-check>
              </ion-card>
            </ion-col>
            ${when(
              model.enabled.valueOf(),
              () => html` <ion-col size="12" size-lg="6">
                <device-card
                  .tracker=${'inreach'}
                  .binder=${this.binder}
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Visit
                    <a href="https://explore.garmin.com/Social" target="_blank"> your InReach social profile</a>
                    and copy your MapShare address in the field below (it should look like
                    <strong>https://share.garmin.com/username</strong> or
                    <strong>https://share.garmin.com/Feed/Share/username</strong>).
                  </ion-text>`}
                  label="MapShare URL"
                  inputmode="url"
                >
                </device-card>
              </ion-col>`,
            )}
          </ion-row>
          ${when(
            model.enabled.valueOf(),
            () => html`</ion-row>
            <ion-row>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'spot'}
                  .binder=${this.binder}
                  label="Feed Id"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Create an XML feed by following the instructions on this
                    <a
                      href="https://www.findmespot.com/en-us/support/spot-gen4/get-help/general/public-api-and-xml-feed"
                      target="_blank"
                      >page</a
                    >
                    and copy the feed id into the field below (it should look like
                    <strong>0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq</strong>).
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'skylines'}
                  .binder=${this.binder}
                  label="Pilot Id"
                  inputmode="numeric"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Your pilot's id is at the end of your SkyLines profile url:
                    <strong>https://skylines.aero/users/id</strong> (it should be a numerical value like
                    <strong>1234</strong>).
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'flyme'}
                  .binder=${this.binder}
                  label="Username"
                  inputmode="email"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Enter your FlyMe (XCGlobe) username in the field above. It commonly is your email.
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'flymaster'}
                  .binder=${this.binder}
                  label="Device Id"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Login to
                    <a href="https://lt.flymaster.net" target="_blank">lt.flymaster.net</a> and click on "My account",
                    followed by "My Instruments". Paste the numerical id of the instrument in the field below. You must
                    also join the "flyxc.app" group (5911).
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'ogn'}
                  .binder=${this.binder}
                  label="Id"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Enter your OGN Device ID. It is a 6 hexadecimal digits (0-9, a-f) value from
                    <a href="http://ddb.glidernet.org/" target="_blank">the device database</a>. flyXC will retrieve
                    your position when you have a device setup to push to OGN (XCTracer, SeeYou navigator, ...).
                    Otherwise flyXC will publish your position from other enabled tracking devices to OGN.
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
              <ion-col size=12 size-lg=6>
                <ion-card class="ion-padding-bottom">
                  <ion-card-header color="secondary">
                    <ion-card-title><i class="las la-calculator"></i> zoleo</ion-card-title>
                  </ion-card-header>
                  <flow-ion-check label="Enabled" labelOff="Disabled" ...=${field(
                    this.binder.model.zoleo.enabled,
                  )}></flow-ion-check>
                  ${when(this.binder.model.zoleo.enabled.valueOf(), () =>
                    when(
                      this.binder.model.zoleo.account.valueOf().length == 0,
                      () => html`<ion-item lines="full">
                        <ion-button size="default" @click=${async () => await this.startZoleoShareFlow()}
                          ><i class="las la-link la-lg"></i> Link a device</ion-button
                        >
                      </ion-item>`,
                      () => html`<ion-item lines="full">
                        <ion-button size="default" @click=${async () => await this.unlinkZoleo()}
                          ><i class="las la-unlink la-lg"></i>Unlink your device</ion-button
                        >
                      </ion-item>`,
                    ),
                  )}
                </ion-card>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'xcontest'}
                  .binder=${this.binder}
                  label="UUID"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Enter your XContest UUID. It is a 28 letter/number value from
                    <a href="https://www.xcontest.org/world/en/my-groups:flyxc" target="_blank">your groups</a>. Make
                    sure to join the flyxc.app group first.
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
              <ion-col size=12 size-lg=6>
                <device-card
                  .tracker=${'meshbir'}
                  .binder=${this.binder}
                  label="UUID"
                  .hint=${html`<ion-text class="ion-padding-horizontal ion-padding-top block">
                    Enter your Paratracker ID. It should look like "12345678-ab45-b23c-8549-1f3456c89e12". Jigish Gohil
                    explains the setup in
                    <a href="https://youtu.be/NuzwphHiXkI?si=6MW1hl8fodEnOTgd" target="_blank">this video</a>.
                  </ion-text>`}
                >
                </device-card>
              </ion-col>
            </ion-row>`,
          )}
        </ion-grid>
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${async () => await this.save()} fill="solid" color="primary">Save</ion-button>
          </ion-buttons>
          <ion-buttons slot="secondary">
            <ion-button @click=${async () => await this.close()}>Cancel</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    `;
  }

  private async unlinkZoleo() {
    const binderNode = this.binder.for(this.binder.model.zoleo.account);
    binderNode.value = '';
    binderNode.visited = true;
    await fetchResponse(`${import.meta.env.VITE_API_SERVER}/api/zoleo/unlink`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  private async startZoleoShareFlow() {
    // Add event listener
    this.zoleoEventAbortController = new AbortController();
    const { signal } = this.zoleoEventAbortController;
    window.addEventListener('message', async (e: MessageEvent) => await this.zoleoMessageListener(e), { signal });

    // Open the zoleo page
    const params = new URLSearchParams({
      partnerID: 'fa7b8762-0166-42dd-b2df-f3c958153570',
      username: this.binder.model.name.valueOf(),
      partnerURL: 'https://flyxc.app',
    });

    window.open(`https://www.link.zoleo.com?${params.toString()}`, '_blank');

    // Display dialog (with cancel)
    this.zoleoAlert = await alertController.create({
      header: 'zoleo',
      message: 'Waiting for confirmation from zoleo...',
      buttons: [
        {
          text: 'Cancel',
          handler: () => {
            this.zoleoEventAbortController?.abort();
          },
        },
      ],
      backdropDismiss: false,
    });
    await this.zoleoAlert.present();
  }

  private async zoleoMessageListener(event: MessageEvent) {
    this.zoleoEventAbortController?.abort();
    if (event.origin !== 'https://www.link.zoleo.com') {
      console.error('Invalid event origin.');
      return;
    }

    if (event.data.status !== 200) {
      console.error(`Zoleo error status ${event.data.status}`);
      return;
    }

    const { partnerDeviceID } = event.data;
    if (partnerDeviceID) {
      const zoleoModel = this.binder.model.zoleo;
      const binderNode = this.binder.for(zoleoModel.account);
      binderNode.value = partnerDeviceID;
      binderNode.visited = true;
      const payload = {
        name: this.binder.model.name.valueOf(),
        account: partnerDeviceID,
        enabled: zoleoModel.enabled.valueOf(),
      };
      await fetchResponse(`${import.meta.env.VITE_API_SERVER}/api/zoleo/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      await this.zoleoAlert?.dismiss();
    }
  }

  // Navigates back to the application or the admin page.
  //
  // Use the return url when set.
  private async close(): Promise<void> {
    if (this.accountId == null) {
      try {
        await fetch(`${import.meta.env.VITE_API_SERVER}/api/live/logout`, { method: 'POST', credentials: 'include' });
      } catch (e) {
        // empty
      }
      const url = localStorage.getItem('url.tracking.return');
      document.location.assign(url ?? import.meta.env.VITE_APP_SERVER);
    } else {
      document.location.assign(`${import.meta.env.VITE_APP_SERVER}/adm`);
    }
  }

  // Saves the form values.
  private async save(): Promise<void> {
    const errors = await this.binder.validate();
    if (errors.length > 0) {
      const alert = await alertController.create({
        header: 'Settings error',
        message: `Please fix the validation errors before saving.`,
        buttons: [
          {
            text: 'Ok',
            role: 'cancel',
          },
        ],
      });
      await alert.present();
      return;
    }
    this.isSubmitting = true;
    let error: string | undefined;

    try {
      await this.binder.submitTo(async (values) => {
        let response: any;

        try {
          response = await fetch(this.getAction(), {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'xsrf-token': this.xsrfToken,
            },
            body: JSON.stringify(values),
          });
        } catch (e) {
          error = 'Unexpected error, please try again later!';
          return;
        }

        if (!response.ok) {
          error = 'Unexpected error, please try again later!';
          return;
        }

        const status = await response.json();

        if (status.error) {
          error = status.error;
          throw { validationErrorData: status.validationErrorData };
        }
        // Reload the whole state after a device update.
        setFetchMillis(0);
      });
    } catch (e) {
      console.error(e);
    }

    if (error) {
      const alert = await alertController.create({
        header: 'Settings error',
        message: `An error has occurred: ${error}`,
        buttons: [
          {
            text: 'Ok',
            role: 'cancel',
          },
        ],
      });
      await alert.present();
      this.isSubmitting = false;
    } else {
      const alert = await alertController.create({
        header: 'Settings updated',
        message: `Your settings have been updated. Please allow up to 15 minutes for changes to take effect.`,
        buttons: [
          {
            text: 'Ok',
            role: 'cancel',
          },
        ],
      });
      await alert.present();
      await alert.onDidDismiss();
      await this.close();
    }
  }

  // Render the login info and button.
  private renderLogin(): TemplateResult {
    return html`
      <ion-content fullscreen class="ion-padding">
        <p>Sign in to configure your trackers by using the button below.</p>
        <p>
          Once your trackers have been configured, your tracks for the past 24 hours will appear on the map. The
          positions are automatically refreshed as they become available
          <strong>there is no need to manually reload</strong> the browser window.
        </p>
        <p>
          flyXC records your name, email address, tracker address and the position of your tracker during the last 24
          hours only. While you need a google account to login to flyXC, no information is ever shared with Google.
        </p>
        <p>Supported platforms:</p>
        <ul>
          <li>
            <a href="https://www.garmin.com/en-US/inreach/personal/" target="_blank">InReach</a>
          </li>
          <li><a href="https://www.findmespot.com/" target="_blank">Spot</a></li>
          <li><a href="https://skylines.aero/tracking/info" target="_blank">SkyLines</a></li>
          <li><a href="http://xcglobe.com/flyme" target="_blank">XCGlobe FlyMe</a></li>
          <li><a href="https://www.flymaster.net/" target="_blank">Flymaster</a></li>
          <li><a href="https://www.zoleo.com/" target="_blank">zoleo</a></li>
          <li>
            <a href="https://www.glidernet.org/" target="_blank">OGN (Open Glider Network)</a>
          </li>
          <li><a href="https://live.xcontest.org/" target="_blank">XCTrack (XContest live)</a></li>
          <li><a href="https://paratracker.in/" target="_blank">Paratracker (LoRa mesh based)</a></li>
        </ul>
        <p>
          <a href="mailto:help@flyxc.app?subject=flyXC%20registration%20error" target="_blank"> Contact us by email </a>
          if you have any trouble registering your device.
        </p>
        <google-btn callback=${this.getCallback()}></google-btn>
      </ion-content>
    `;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private getAction(): string {
    return this.accountId == null
      ? `${import.meta.env.VITE_API_SERVER}/api/live/account.json`
      : `${import.meta.env.VITE_API_SERVER}/api/admin/account/${this.accountId}.json`;
  }

  private getCallback(): string {
    return this.accountId == null
      ? `${import.meta.env.VITE_APP_SERVER}/devices`
      : `${import.meta.env.VITE_APP_SERVER}/adm/account/${this.accountId}`;
  }
}
