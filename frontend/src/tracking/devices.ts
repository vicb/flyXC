// Login for tracker settings.
//
// Note: this file is named devices.ts because tracking.ts makes ublock origin unhappy.
//
// See https://developers.google.com/identity/sign-in/web.

import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';

declare const gapi: any;

@customElement('device-form')
export class DeviceForm extends LitElement {
  @internalProperty()
  private auth: any;

  @internalProperty()
  private signedIn = false;

  @internalProperty()
  private device = 'no';

  @internalProperty()
  private changesSaved = false;

  constructor() {
    super();
    window.addEventListener('sign-in', () => {
      this.auth = gapi.auth2.getAuthInstance();
      this.signedIn = this.auth.isSignedIn.get();
      if (this.signedIn) {
        this.onSignIn();
      }
    });
  }

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
    `;
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css" />
      <section class="hero is-primary">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">Tracker configuration</h1>
            <h2 class="subtitle">Configure your live tracking device.</h2>
          </div>
        </div>
      </section>

      <div class="container">
        ${!this.signedIn
          ? html`
              <div class="notification my-4 content">
                <p class="my-4">Sign in to configure your tracking device by using the button below.</p>
                <p class="my-4">
                  Once your tracker has been configured, your tracks for the past 24 hours will appear on the map. The
                  positions are automatically refreshed as they become available
                  <strong>there is no need to manually reload</strong> the browser window.
                </p>
                <p class="my-4">
                  FlyXC records your name, email address, tracker address and the position of your tracker during the
                  last 24 hours only.
                </p>
                <p class="my-4">
                  You can disable tracking at any moment by setting your device to <strong>"Do not track me"</strong>.
                </p>
                <p class="my-4">
                  Supported devices:
                  <ul class="my-4">
                    <li><a href="https://www.garmin.com/en-US/inreach/personal/" target="_blank" class="has-text-link">InReach</a></li>
                    <li><a href="https://www.findmespot.com/" target="_blank" class="has-text-link">Spot</a></li>
                    <li><a href="https://skylines.aero/tracking/info" target="_blank" class="has-text-link">SkyLines</a></li>
                  </ul>
                </p>
                <p class="my-4">
                  <strong>Note:</strong> Due to a current limitation 3rd party cookies must be enabled to login and update your settings.
                  When they are not enabled the "Sign in with Google" button below will re-load this exact same page. 
                  You can revert to your preferred cookies settings after having updated the flyxc settings. 
                  This limitation will be removed in the future.
                </p>                
                <p class="my-4">
                  <a href="mailto:help@flyxc.app?subject=FlyXC%20registration%20error" class="has-text-link">Contact us</a> if you have any
                  trouble registering your device.
                </p>
              </div>
              <slot name="button"></slot>
            `
          : html`
              <div class="notification my-4 content">
                <p class="my-4">
                  <strong>${this.auth.currentUser.get().getBasicProfile().getName()}</strong> configure your device
                  below.
                </p>
                <p class="my-4">
                  Only one device could be active at a given time. Select "Do not track me" to temporarily disable the
                  flyxc.app tracking (your position will no more appear on the map).
                </p>
                <p class="my-4">
                  <a href="mailto:help@flyxc.app?subject=FlyXC%20registration%20error" class="has-text-link"
                    >Contact us</a
                  >
                  if you have any trouble.
                </p>
              </div>
              <form>
                <div class="field">
                  <label class="label">
                    <input
                      type="radio"
                      id="inreach"
                      name="tracker"
                      value="inreach"
                      @change=${() => (this.device = 'inreach')}
                    />
                    InReach
                  </label>
                </div>
                <div class="field" style=${`display:${this.device == 'inreach' ? 'block' : 'none'}`}>
                  <label class="label"
                    >MapShare address
                    <input
                      class="input"
                      type="text"
                      id="inreach-url"
                      name="inreach-url"
                      placeholder="https://share.garmin.com/user_name"
                    />
                  </label>
                  <p class="help">
                    Visit
                    <a href="https://explore.garmin.com/Social" target="_blank" class="has-text-link"
                      >your InReach social profile</a
                    >
                    and copy your MapShare address in this field (it should look like
                    <span class="has-text-info">https://share.garmin.com/username</span>).
                  </p>
                </div>

                <div class="field">
                  <label class="label">
                    <input type="radio" id="spot" name="tracker" value="spot" @change=${() => (this.device = 'spot')} />
                    Spot
                  </label>
                </div>
                <div class="field" style=${`display:${this.device == 'spot' ? 'block' : 'none'}`}>
                  <label class="label"
                    >XML feed id
                    <input id="spot-id" class="input" type="text" name="spot-id" />
                  </label>
                  <p class="help">
                    Create an XML feed by following the instructions on this
                    <a
                      href="https://www.findmespot.com/en-us/support/spot-trace/get-help/general/spot-api-support"
                      target="_blank"
                      class="has-text-link"
                      >spot support page.</a
                    >
                    and paste the feed id in this field (it should look similar to
                    <span class="has-text-info">0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq</span>).
                  </p>
                </div>

                <div class="field">
                  <label class="label">
                    <input
                      type="radio"
                      id="skylines"
                      name="tracker"
                      value="sklyines"
                      @change=${() => (this.device = 'skylines')}
                    />
                    Skylines
                  </label>
                </div>
                <div class="field" style=${`display:${this.device == 'skylines' ? 'block' : 'none'}`}>
                  <label class="label"
                    >SkyLines pilot id
                    <input id="skylines-id" class="input" type="text" name="skylines-id" />
                  </label>
                  <p class="help">
                    Your SkyLines pilot's id is at the end of your SkyLines profile url:
                    https://skylines.aero/users/<strong>[id]</strong> (it should look like
                    <span class="has-text-info">1234</span>).
                  </p>
                </div>

                <div class="field">
                  <label class="label">
                    <input type="radio" id="no" name="tracker" value="no" @change=${() => (this.device = 'no')} />
                    Do not track me
                  </label>
                </div>
                <div class="field" style=${`display:${this.device == 'no' ? 'block' : 'none'}`}>
                  <p class="help">Live tracking is disabled and your position will not appear on the map.</p>
                </div>

                <div class="field is-grouped">
                  <p class="control">
                    <a class="button is-primary" @click=${() => this.updateTracker()}> Save </a>
                  </p>
                  <p class="control">
                    <a
                      class="button is-light"
                      @click=${(): void => {
                        this.auth.signOut();
                        document.location.href = '/';
                      }}
                    >
                      Cancel
                    </a>
                  </p>
                </div>
              </form>
              <div class=${this.changesSaved ? 'modal is-active' : 'modal'} @click=${() => this.handleClose()}>
                <div class="modal-background"></div>
                <div class="modal-content">
                  <div class="notification my-4">
                    <p class="my-2">Your device configuration has been updated.</p>
                    <p class="my-2">Click the close button to navigate back to the map.</p>
                  </div>
                </div>
                <button class="modal-close is-large" aria-label="close"></button>
              </div>
            `}
      </div>
    `;
  }

  private updateTracker(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const data = [
      `device=${encodeURIComponent(this.device)}`,
      `token=${encodeURIComponent(this.auth.currentUser.get().getAuthResponse().id_token)}`,
      `inreach=${(shadowRoot.getElementById('inreach-url') as HTMLInputElement)?.value}`,
      `spot=${(shadowRoot.getElementById('spot-id') as HTMLInputElement)?.value}`,
      `skylines=${(shadowRoot.getElementById('skylines-id') as HTMLInputElement)?.value}`,
    ];
    fetch('_updateTracker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data.join('&'),
    }).then(() => {
      this.auth.signOut();
      this.changesSaved = true;
    });
  }

  private onSignIn(): void {
    const user = this.auth.currentUser.get();
    const data = [
      `token=${encodeURIComponent(user.getAuthResponse().id_token)}`,
      `email=${encodeURIComponent(user.getBasicProfile().getEmail())}`,
      `name=${encodeURIComponent(user.getBasicProfile().getName())}`,
    ];
    fetch('_tokenSignIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data.join('&'),
    })
      .then((r) => r.json())
      .then((data) => {
        const shadowRoot = this.shadowRoot as ShadowRoot;
        // Radio buttons
        ['inreach', 'spot', 'skylines', 'no'].map((device) => {
          const radio = shadowRoot.getElementById(device) as HTMLInputElement;
          if (data.device == device) {
            radio.setAttribute('checked', '');
          }
        });
        this.device = data.device;
        const inreach = shadowRoot.getElementById('inreach-url') as HTMLInputElement;
        inreach.value = data.inreach;
        const spot = shadowRoot.getElementById('spot-id') as HTMLInputElement;
        spot.value = data.spot;
        const skylines = shadowRoot.getElementById('skylines-id') as HTMLInputElement;
        skylines.value = data.skylines;
      });
  }

  private handleClose(): void {
    document.location.href = '/';
  }
}
