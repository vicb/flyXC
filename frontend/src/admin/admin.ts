import '../google-btn';

import { trackerPropNames } from 'flyxc/common/src/live-track';
import { round } from 'flyxc/common/src/math';
import { Keys } from 'flyxc/common/src/redis';
import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  TemplateResult,
} from 'lit-element';

@customElement('admin-app')
export class AdminPage extends LitElement {
  @internalProperty()
  private isLoading = true;

  @internalProperty()
  private connected = false;

  @internalProperty()
  private values: unknown;

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
    fetch(`/_admin.json`).then(async (response) => {
      this.isLoading = false;
      this.values = await response.json();
      this.connected = response.ok;
    });
  }

  render(): TemplateResult {
    const parts: TemplateResult[] = [];

    if (this.isLoading) {
      parts.push(html`
        <div class="notification my-4 content">
          <progress class="progress is-small is-primary" max="100">60%</progress>
        </div>
      `);
    } else if (!this.connected) {
      parts.push(html`<google-btn override="admin"></google-btn>`);
    } else if (this.values) {
      parts.push(html`<dash-summary .values=${this.values}></dash-summary>`);
      for (const name of Object.values(trackerPropNames)) {
        parts.push(html`<dash-tracker .values=${this.values} name=${name}></dash-tracker>`);
      }
    }

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css" />

      <section class="hero is-dark">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">FlyXC admin</h1>
            <h2 class="subtitle">Dashboard</h2>
          </div>
        </div>
      </section>

      <div class="container">${parts}</div>`;
  }
}

@customElement('dash-summary')
export class DashSummary extends LitElement {
  @property({ attribute: false })
  values: any;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
      .panel-block {
        display: block;
      }
      .panel {
        font-size: 0.8rem !important;
      }
    `;
  }

  render(): TemplateResult {
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css" />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>Summary</p>
        </div>
        <div class="panel-block">
          <ul>
            <li>Uploaded tracks: ${this.values[Keys.dashboardTotalTracks]}</li>
            <li>Trackers: ${this.values[Keys.dashboardTotalTrackers]}</li>
            <li>Trackers active h24: ${this.values[Keys.trackerFullSize]}</li>
            <li>Trackers active h2: ${this.values[Keys.trackerIncrementalSize]}</li>
            <li>Last refresh: ${relativeTime(this.values[Keys.trackerUpdateSec])}</li>
          </ul>
        </div>
      </div>`;
  }
}

@customElement('dash-tracker')
export class DashTracker extends LitElement {
  @property({ attribute: false })
  values: any;

  @property()
  name = '';

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
      .panel-block {
        display: block;
      }
      .panel {
        font-size: 0.8rem !important;
      }
    `;
  }

  render(): TemplateResult {
    const number = this.values[Keys.dashboardNumTrackers.replace('{name}', this.name)];
    const fetchTimes = this.values[Keys.trackerLogsTime.replace('{name}', this.name)].map(relativeTime);
    const durations = this.values[Keys.trackerLogsDuration.replace('{name}', this.name)];
    const numDevices = this.values[Keys.trackerLogsSize.replace('{name}', this.name)];
    const topErrors: [string, string][] = [];
    this.values[Keys.dashboardTopErrors.replace('{name}', this.name)].split(',').forEach((entry: string) => {
      const m = entry.match(/id=(\d+) errors=(\d+)/i);
      if (m) {
        topErrors.push([m[1], m[2]]);
      }
    });
    const errorsById: [string, string, string][] = [];
    this.values[Keys.trackerLogsErrorsById.replace('{name}', this.name)].forEach((entry: string) => {
      const m = entry.match(/\[(\d+)\] id=(\d+) (.*)/i);
      if (m) {
        errorsById.push([relativeTime(Number(m[1])), m[2], m[3]]);
      }
    });
    const errors: string[] = [];
    this.values[Keys.trackerLogsErrors.replace('{name}', this.name)].forEach((entry: string) => {
      const m = entry.match(/\[(\d+)\] (.*)/i);
      if (m) {
        errors.push(`${relativeTime(Number(m[1]))} ${m[2]}`);
      }
    });

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css" />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>${this.name}</p>
        </div>
        <div class="panel-block">
          <ul>
            <li>Trackers: ${number}</li>
            <li>Fetches: ${fetchTimes.join(', ')}</li>
            <li>Duration: ${durations.join(', ')}</li>
            <li>Devices: ${numDevices.join(', ')}</li>
          </ul>
          <p><strong>Top errors</strong></p>
          <ul>
            ${topErrors.map(
              ([id, error]) => html`<li><a href=${entityHref(id)} target="_blank">${id}</a> ${error}</li>`,
            )}
          </ul>
          <p><strong>Device errors</strong></p>
          <ul>
            ${errorsById.map(
              ([time, id, error]) =>
                html`<li>${time} <a href=${entityHref(id)} target="_blank">${id}</a> ${error}</li>`,
            )}
          </ul>
          <p><strong>Errors</strong></p>
          <ul>
            ${errors.map((error) => html`<li>${error}</li>`)}
          </ul>
        </div>
      </div>`;
  }
}

// Returns readable time relative to now.
function relativeTime(time: number) {
  const delta = Date.now() / 1000 - time;
  if (delta >= 24 * 3600) {
    return `-${round(delta / (24 * 3600), 1)}d`;
  }
  if (delta >= 3600) {
    return `-${round(delta / 3600, 1)}h`;
  }
  if (delta >= 60) {
    return `-${round(delta / 60, 0)}min`;
  }
  return `-${round(delta, 0)}s`;
}

// Link to the entity in the cloud console.
function entityHref(id: string) {
  const key = btoa(`key('LiveTrack',${id})`.replace(/=/g, '.'));
  return `https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__/query/kind;filter=%5B%227%2F__key__%7CKEY%7CEQ%7C48%2F${key}%22%5D?project=fly-xc`;
}
