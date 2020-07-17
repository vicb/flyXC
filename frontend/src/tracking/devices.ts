// Login for tracker settings.
//
// Note: this file is named devices.ts because tracking.ts makes ublock origin unhappy.
//
// See https://developers.google.com/identity/sign-in/web.

import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

declare const gapi: any;

@customElement('device-form')
export class DeviceForm extends LitElement {
  @property({ attribute: false })
  auth: any;

  @property({ attribute: false })
  signedIn = false;

  @property({ attribute: false })
  device = 'no';

  @property({ attribute: false })
  changesSaved = false;

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

  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          font: 14px 'Nobile', verdana, sans-serif;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css" />
      <section class="hero is-primary">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">
              Tracker configuration
            </h1>
            <h2 class="subtitle">
              Configure your live tracking device.
            </h2>
          </div>
        </div>
      </section>

      <div class="container">
        ${!this.signedIn
          ? html`
              <div class="notification my-4">
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
                  You can disable tracking at any moment by setting your device to <strong>"no"</strong>.
                </p>
              </div>
              <slot name="button"></slot>
            `
          : html`
              <div class="notification my-4">
                <strong>${this.auth.currentUser.get().getBasicProfile().getName()}</strong>, select your device:
              </div>
              <form>
                <div class="field">
                  <label class="label">
                    <input
                      type="radio"
                      id="inreach"
                      name="tracker"
                      value="inreach"
                      @change=${(): void => void (this.device = 'inreach')}
                    />
                    InReach
                  </label>
                </div>

                <div class="field" style=${`display:${this.device == 'inreach' ? 'block' : 'none'}`}>
                  <label class="label"
                    >Raw KML data feed
                    <input
                      class="input"
                      type="text"
                      id="inreach-url"
                      name="inreach-url"
                      placeholder="https://inreach.garmin.com/Feed/Share/user_name"
                    />
                  </label>
                  <p class="help">
                    See
                    <a href="https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8" target="_blank"
                      >this Garmin post</a
                    >
                    to retrieve the <strong>raw KML data</strong> feed url
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
                    >SPOT id
                    <input id="spot-id" class="input" type="text" name="spot-id" />
                  </label>
                  <p class="help">
                    The id for your spot device is at the end of your shared page url:
                    http://share.findmespot.com/shared/faces/viewspots.jsp?glId=<strong>[id]</strong>
                  </p>
                </div>
                <div class="field">
                  <label class="label">
                    <input
                      type="radio"
                      id="no"
                      name="tracker"
                      value="no"
                      @change=${(): void => void (this.device = 'no')}
                    />
                    Do not track me
                  </label>
                </div>
                <div class="field is-grouped">
                  <p class="control">
                    <a class="button is-primary" @click=${(): void => this.updateTracker()}>
                      Save
                    </a>
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

  protected updateTracker(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const data = [
      `device=${encodeURIComponent(this.device)}`,
      `token=${encodeURIComponent(this.auth.currentUser.get().getAuthResponse().id_token)}`,
      `inreach=${(shadowRoot.getElementById('inreach-url') as HTMLInputElement)?.value}`,
      `spot=${(shadowRoot.getElementById('spot-id') as HTMLInputElement)?.value}`,
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

  protected onSignIn(): void {
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
        ['inreach', 'spot', 'no'].map((device) => {
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
      });
  }

  protected handleClose(): void {
    document.location.href = '/';
  }
}
