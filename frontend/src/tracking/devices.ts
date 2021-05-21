// Login for tracker settings.
//
// Note: this file is named devices.ts because tracking.ts makes ublock origin unhappy.
import '../google-btn';
import './device-form';

import { AccountModel } from 'flyxc/common/src/models';
import { css, CSSResult, customElement, html, LitElement, state, TemplateResult } from 'lit-element';

@customElement('device-config')
export class DeviceConfig extends LitElement {
  @state()
  private account?: AccountModel;

  @state()
  private isLoading = true;

  private token = '';

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    fetch(`/_account`)
      .then((response) => {
        this.isLoading = false;
        this.token = response.headers.get('xsrf-token') ?? '';
        return response.ok ? response.json() : null;
      })
      .then((account) => {
        this.account = account;
      });
  }

  render(): TemplateResult {
    let body: TemplateResult;

    if (this.isLoading) {
      body = html`
        <div class="notification my-4 content">
          <progress class="progress is-small is-primary" max="100">60%</progress>
        </div>
      `;
    } else if (this.account == null) {
      body = html`<div class="notification my-4 content">
        <p class="my-4">Sign in to configure your trackers by using the button below.</p>
        <p class="my-4">
          Once your trackers have been configured, your tracks for the past 24 hours will appear on the map. The
          positions are automatically refreshed as they become available
          <strong>there is no need to manually reload</strong> the browser window.
        </p>
        <p class="my-4">
          FlyXC records your name, email address, tracker address and the position of your tracker during the last 24
          hours only. While you need a google account to login to FlyXC, no information is ever shared with Google.
        </p>
        <p class="my-4">Supported platforms:</p>
        <ul class="my-4">
          <li>
            <a href="https://www.garmin.com/en-US/inreach/personal/" target="_blank" class="has-text-link">InReach</a>
          </li>
          <li><a href="https://www.findmespot.com/" target="_blank" class="has-text-link">Spot</a></li>
          <li><a href="https://skylines.aero/tracking/info" target="_blank" class="has-text-link">SkyLines</a></li>
          <li><a href="http://xcglobe.com/flyme" target="_blank" class="has-text-link">XCGlobe FlyMe</a></li>
          <li><a href="https://www.flymaster.net/" target="_blank" class="has-text-link">Flymaster</a></li>
        </ul>
        <p class="my-4">
          <a href="mailto:help@flyxc.app?subject=FlyXC%20registration%20error" class="has-text-link" target="_blank"
            >Contact us</a
          >
          if you have any trouble registering your device.
        </p>
        <google-btn></google-btn>
      </div>`;
    } else {
      body = html`<device-form .token=${this.token} .account=${this.account}></device-form>`;
    }

    return html`
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <section class="hero is-dark">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">Tracker configuration</h1>
            <h2 class="subtitle">Configure your live tracking devices.</h2>
          </div>
        </div>
      </section>

      <div class="container">${body}</div>
    `;
  }
}
