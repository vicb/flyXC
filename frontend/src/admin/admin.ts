import '../google-btn';

import { trackerPropNames } from 'flyxc/common/src/live-track';
import { round } from 'flyxc/common/src/math';
import { Keys } from 'flyxc/common/src/redis';
import { css, CSSResult, customElement, html, LitElement, property, state, TemplateResult } from 'lit-element';

const REFRESH_MIN = 15;

const GQL_URL = `https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__/query/gql;gql=SELECT%2520*%2520FROM%2520LiveTrack%2520WHERE%2520{name}.enabled%253Dtrue?project=fly-xc`;

const ICON_SVG = (
  count = 0,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
<path fill="none" stroke="#000" d="M5 12V6h9M27 17v11h-4"/>
<path fill="#4e525d" stroke="#000" d="M19.86 16.86h0l-.07.06a5.72 5.72 0 01-5.43 1.5h0v-4.7L12 15.28 9.64 13.7v4.72h0a5.72 5.72 0 01-5.43-1.5l-.07-.07h0A7.86 7.86 0 001 23.14h0a3.41 3.41 0 013.93 3.93h0a5.4 5.4 0 016.67 3l.4.93.4-.93a5.4 5.4 0 016.67-3h0A3.41 3.41 0 0123 23.14h0a7.86 7.86 0 00-3.14-6.28z"/>
${
  count > 0
    ? `<text x="19" y="10" font-size="20px" font-family="sans-serif" alignment-baseline="middle" font-weight="bolder" fill="#f60" stroke="none">${
        count > 9 ? '+' : count
      }</text>`
    : `<circle cx="25" cy="7" r="4" fill="#f23c50" stroke="#000" />
<path fill="none" stroke="#000" d="M29 7h2M19 7h2M27.83 4.17l1.41-1.41M20.76 11.24l1.41-1.41M25 3V1M25 13v-2M22.17 4.17l-1.41-1.41M29.24 11.24l-1.41-1.41"/>`
}  
</svg>`;

@customElement('admin-app')
export class AdminPage extends LitElement {
  @state()
  private isLoading = true;

  @state()
  private connected = false;

  @state()
  private values: unknown;

  private timer: any;
  private lastFetch = 0;

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
    this.fetch();
    this.timer = setInterval(() => {
      const ageMin = (Date.now() - this.lastFetch) / (60 * 1000);
      if (ageMin > REFRESH_MIN) {
        this.fetch();
      }
    }, 1000 * 60);
  }

  disconnectedCallback(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
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
      parts.push(html`<google-btn override="admin" style="margin-top: 10px"></google-btn>`);
    } else if (this.values) {
      parts.push(html`<dash-summary .values=${this.values} @sync=${this.fetch}></dash-summary>`);
      for (const name of Object.values(trackerPropNames)) {
        parts.push(html`<dash-tracker .values=${this.values} name=${name}></dash-tracker>`);
      }
    }

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />

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

  private fetch() {
    this.isLoading = true;
    this.lastFetch = Date.now();
    fetch(`/_admin.json`).then(async (response) => {
      this.isLoading = false;
      this.connected = response.ok;
      if (response.ok) {
        this.values = await response.json();
      }
    });
  }
}

@customElement('dash-summary')
export class DashSummary extends LitElement {
  @property({ attribute: false })
  values: any;

  private link?: HTMLLinkElement;
  private timer: any;

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

  connectedCallback(): void {
    super.connectedCallback();
    this.link = document.createElement('link');
    this.link.setAttribute('rel', 'shortcut icon');
    this.link.href = `data:image/svg+xml;base64,${btoa(ICON_SVG())}`;
    document.head.append(this.link);
    this.timer = setInterval(() => {
      this.requestUpdate();
    }, 10 * 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.link) {
      this.link.remove();
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  render(): TemplateResult {
    const trackerH1 = this.values[Keys.trackerIncrementalSize];
    if (this.link) {
      this.link.href = `data:image/svg+xml;base64,${btoa(ICON_SVG(trackerH1))}`;
    }
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>Summary</p>
        </div>
        <div class="panel-block">
          <ul>
            <li>Uploaded tracks: ${this.values[Keys.dashboardTotalTracks]}</li>
            <li>
              <a
                href="https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__;sortCol=created;sortDir=DESCENDING/query/kind?project=fly-xc"
                target="_blank"
                >Trackers: ${this.values[Keys.dashboardTotalTrackers]}</a
              >
            </li>
            <li>Trackers h24: ${this.values[Keys.trackerFullSize]}</li>
            <li>Trackers h1: ${trackerH1}</li>
            <li>Last refresh: ${relativeTime(this.values[Keys.trackerUpdateSec])}</li>
          </ul>
          <div class="buttons" style="margin-top: .5rem">
            <button class="button is-success is-small" @click=${() => this.dispatchEvent(new CustomEvent('sync'))}>
              <i class="la la-sync la-2x"></i> Refresh
            </button>
            <a class="button is-danger is-small" href="/logout"><i class="la la-power-off la-2x"></i> Sign out</a>
          </div>
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
    const oldTimeSec = Date.now() / 1000 - 24 * 3 * 3600;
    const number = this.values[Keys.dashboardNumTrackers.replace('{name}', this.name)] ?? 0;
    const fetchTimes = this.values[Keys.trackerLogsTime.replace('{name}', this.name)].map(relativeTime);
    const durations = this.values[Keys.trackerLogsDuration.replace('{name}', this.name)];
    const numDevices = this.values[Keys.trackerLogsSize.replace('{name}', this.name)];
    const topErrors: [string, string][] = [];
    (this.values[Keys.dashboardTopErrors.replace('{name}', this.name)] ?? '').split(',').forEach((entry: string) => {
      const m = entry.match(/id=(\d+) errors=(\d+)/i);
      if (m) {
        topErrors.push([m[1], m[2]]);
      }
    });
    const errorsById: [string, string, string][] = [];
    const oldErrorsById: [string, string, string][] = [];
    this.values[Keys.trackerLogsErrorsById.replace('{name}', this.name)].forEach((entry: string) => {
      const m = entry.match(/\[(\d+)\] id=(\d+) (.*)/i);
      if (m) {
        const timeSec = Number(m[1]);
        if (timeSec < oldTimeSec) {
          oldErrorsById.push([relativeTime(Number(m[1])), m[2], m[3]]);
        } else {
          errorsById.push([relativeTime(Number(m[1])), m[2], m[3]]);
        }
      }
    });
    const oldErrors: string[] = [];
    const errors: string[] = [];
    this.values[Keys.trackerLogsErrors.replace('{name}', this.name)].forEach((entry: string) => {
      const m = entry.match(/\[(\d+)\] (.*)/i);
      if (m) {
        const timeSec = Number(m[1]);
        if (timeSec < oldTimeSec) {
          oldErrors.push(`${relativeTime(Number(m[1]))} ${m[2]}`);
        } else {
          errors.push(`${relativeTime(Number(m[1]))} ${m[2]}`);
        }
      }
    });

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>${this.name}</p>
        </div>
        <div class="panel-block">
          <ul>
            <li><a href=${GQL_URL.replace('{name}', this.name)} target="_blank">Trackers: ${number}</a></li>
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
          ${oldErrorsById.length > 0
            ? html`<details>
                <summary>Old</summary>
                <ul>
                  ${oldErrorsById.map(
                    ([time, id, error]) =>
                      html`<li>${time} <a href=${entityHref(id)} target="_blank">${id}</a> ${error}</li>`,
                  )}
                </ul>
              </details>`
            : null}
          <p><strong>Errors</strong></p>
          <ul>
            ${errors.map((error) => html`<li>${error}</li>`)}
          </ul>
          ${oldErrors.length > 0
            ? html`<details>
                <summary>Old</summary>
                <ul>
                  ${oldErrors.map((error) => html`<li>${error}</li>`)}
                </ul>
              </details>`
            : null}
        </div>
      </div>`;
  }
}

// Returns readable relative time.
function relativeTime(timeSec: number): string {
  const delta = Date.now() / 1000 - timeSec;
  if (delta >= 24 * 3600 * 7) {
    return `-${round(delta / (24 * 3600 * 7), 1)}w`;
  }
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
