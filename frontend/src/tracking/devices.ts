// Login for tracker settings.
//
// Note: this file is named devices.ts because tracking.ts makes ublock origin unhappy.

import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';

import { TrackerInfo } from '../../../common/trackers';

@customElement('device-form')
export class DeviceForm extends LitElement {
  @internalProperty()
  private tracker?: TrackerInfo;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
      input[type='image']:hover {
        box-shadow: 0 0 3px #4285f4;
      }
      input[type='image']:active {
        box-shadow: 0 0 3px #073888;
      }
      input[type='image']:focus {
        outline: none;
      }
    `;
  }

  connectedCallback(): void {
    fetch(`/_tracker`)
      .then((r) => (r.ok ? r.json() : null))
      .then((trackers) => {
        if (trackers) {
          this.tracker = trackers;
        }
      });
    super.connectedCallback();
  }

  render(): TemplateResult {
    let body: TemplateResult;

    if (this.tracker == null) {
      body = html`
        <div class="notification my-4 content">
          <progress class="progress is-small is-primary" max="100">60%</progress>
        </div>
      `;
    } else if (!this.tracker.signedIn) {
      body = html`<div class="notification my-4 content">
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
        <a href="mailto:help@flyxc.app?subject=FlyXC%20registration%20error" class="has-text-link">Contact us</a> if you have any
        trouble registering your device.
      </p>
    </div>
    <form action='/oauth/google'>
      <input type="image" src=${`/img/btn_google_signin_dark_normal_web${
        devicePixelRatio > 1 ? '@2x' : ''
      }.png`} alt="Sign-in with Google" width=191 height=46 />
    </form>`;
    } else {
      body = html`<div class="notification my-4 content">
          <p class="my-4"><strong>${this.tracker.name}</strong> configure your device below.</p>
          <p class="my-4">
            Only one device could be active at a given time. Select "Do not track me" to temporarily disable the
            flyxc.app tracking (your position will no more appear on the map).
          </p>
          <p class="my-4">
            <a href="mailto:help@flyxc.app?subject=FlyXC%20registration%20error" class="has-text-link">Contact us</a>
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
                ?checked=${this.tracker.device == 'inreach'}
                @change=${this.updateDeviceFromRadio}
              />
              InReach
            </label>
          </div>
          <div class="field" style=${`display:${this.tracker.device == 'inreach' ? 'block' : 'none'}`}>
            <label class="label"
              >MapShare address
              <input
                class="input"
                type="text"
                id="inreach-url"
                name="inreach-url"
                placeholder="https://share.garmin.com/user_name"
                value=${this.tracker.inreach}
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
              <input
                type="radio"
                id="spot"
                name="tracker"
                value="spot"
                ?checked=${this.tracker.device == 'spot'}
                @change=${this.updateDeviceFromRadio}
              />
              Spot
            </label>
          </div>
          <div class="field" style=${`display:${this.tracker.device == 'spot' ? 'block' : 'none'}`}>
            <label class="label"
              >XML feed id
              <input id="spot-id" class="input" type="text" name="spot-id" value=${this.tracker.spot} />
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
                value="skylines"
                ?checked=${this.tracker.device == 'skylines'}
                @change=${this.updateDeviceFromRadio}
              />
              Skylines
            </label>
          </div>
          <div class="field" style=${`display:${this.tracker.device == 'skylines' ? 'block' : 'none'}`}>
            <label class="label"
              >SkyLines pilot id
              <input id="skylines-id" class="input" type="text" name="skylines-id" value=${this.tracker.skylines} />
            </label>
            <p class="help">
              Your SkyLines pilot's id is at the end of your SkyLines profile url: https://skylines.aero/users/<strong
                >[id]</strong
              >
              (it should look like <span class="has-text-info">1234</span>).
            </p>
          </div>

          <div class="field">
            <label class="label">
              <input
                type="radio"
                id="no"
                name="tracker"
                value="no"
                ?checked=${this.tracker.device == 'no'}
                @change=${this.updateDeviceFromRadio}
              />
              Do not track me
            </label>
          </div>
          <div class="field" style=${`display:${this.tracker.device == 'no' ? 'block' : 'none'}`}>
            <p class="help">Live tracking is disabled and your position will not appear on the map.</p>
          </div>

          <div class="field is-grouped">
            <p class="control">
              <a class="button is-primary" @click=${this.updateTracker}> Save </a>
            </p>
            <p class="control">
              <a
                class="button is-light"
                @click=${() => {
                  document.location.href = '/logout';
                }}
              >
                Cancel
              </a>
            </p>
          </div>
        </form>`;
    }

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

      <div class="container">${body}</div>

      <div id="dlg" class="modal" @click=${this.handleClose}>
        <div class="modal-background"></div>
        <div class="modal-content">
          <div class="notification my-4">
            <p class="my-2">Your device configuration has been updated.</p>
            <p class="my-2">Click the close button to navigate back to the map.</p>
          </div>
        </div>
        <button class="modal-close is-large" aria-label="close"></button>
      </div>
    `;
  }

  // Update the selected device when a radio element is clicked.
  private updateDeviceFromRadio(event: Event) {
    if (this.tracker) {
      const target = event.target as HTMLInputElement;
      const device = target.getAttribute('id') ?? 'no';
      this.tracker = { ...this.tracker, device };
    }
  }

  private updateTracker(): void {
    if (!this.tracker) {
      return;
    }
    const root = this.renderRoot;
    const data = {
      device: this.tracker.device,
      inreach: (root.querySelector('#inreach-url') as HTMLInputElement)?.value,
      spot: (root.querySelector('#spot-id') as HTMLInputElement)?.value,
      skylines: (root.querySelector('#skylines-id') as HTMLInputElement)?.value,
    };
    fetch('_tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(() => {
      this.renderRoot.querySelector('#dlg')?.classList.add('is-active');
    });
  }

  private handleClose(): void {
    document.location.href = '/';
  }
}
