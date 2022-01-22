import '../google-btn';
import '@alenaksu/json-viewer';

import { FetcherState, Pilot, Tracker } from 'flyxc/common/protos/fetcher-state';
import { trackerPropNames } from 'flyxc/common/src/live-track';
import { round } from 'flyxc/common/src/math';
import { Keys } from 'flyxc/common/src/redis';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

const REFRESH_MIN = 10;

const GQL_URL = `https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__/query/gql;gql=SELECT%2520*%2520FROM%2520LiveTrack%2520WHERE%2520{name}.enabled%253Dtrue?project=fly-xc`;

const FAVICON_SVG = (
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

let lastFetchMs = Date.now();

@customElement('admin-app')
export class AdminPage extends LitElement {
  @state()
  private isLoading = true;

  @state()
  private connected = false;

  @state()
  private values: unknown;

  private timer: any;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        font: 14px 'Nobile', verdana, sans-serif;
      }
      .container {
        margin-bottom: 1em;
      }
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.fetch();
    this.timer = setInterval(() => {
      const ageMin = (Date.now() - lastFetchMs) / (60 * 1000);
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
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />

      <section class="hero is-dark">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">FlyXC admin</h1>
            <h2 class="subtitle">Dashboard</h2>
          </div>
        </div>
      </section>

      <div class="container">
        ${when(!this.connected, () => html`<google-btn override="admin" style="margin-top: 10px"></google-btn>`)}
        ${when(
          this.isLoading && !this.values,
          () =>
            html` <div class="notification my-4 content">
              <progress class="progress is-small is-primary" max="100">60%</progress>
            </div>`,
        )}
        ${when(
          this.values,
          () => html`<dash-summary
              .values=${this.values}
              .isLoading=${this.isLoading}
              @sync=${this.fetch}
            ></dash-summary>
            ${Object.values(trackerPropNames).map(
              (name) => html`<dash-tracker .values=${this.values} name=${name}></dash-tracker>`,
            )}
            <dash-elev .values=${this.values}></dash-elev>
            <dash-sync .values=${this.values}></dash-sync>
            <state-explorer></state-explorer>`,
        )}
      </div>`;
  }

  private fetch() {
    this.isLoading = true;
    lastFetchMs = Date.now();
    fetch(`/admin/_admin.json`).then(async (response) => {
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

  @state()
  private isLoading = false;

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
    this.link.href = `data:image/svg+xml;base64,${btoa(FAVICON_SVG())}`;
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
    const trackerH1 = this.values[Keys.fetcherIncrementalNumTracks];
    const nextStopSec = this.values[Keys.fetcherNextStopSec];
    const lastStopSec = this.values[Keys.fetcherStoppedSec];

    if (this.link) {
      this.link.href = `data:image/svg+xml;base64,${btoa(FAVICON_SVG(trackerH1))}`;
    }
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>Fetcher</p>
        </div>
        <div class="panel-block">
          <ul>
            <li>
              <a
                href="https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__;sortCol=created;sortDir=DESCENDING/query/kind?project=fly-xc"
                target="_blank"
                >Trackers: ${this.values[Keys.trackerNum]}</a
              >
            </li>
            <li>Trackers h24: ${this.values[Keys.fetcherFullNumTracks]}</li>
            <li>Trackers h1: ${trackerH1}</li>
            <li>Last device updated: ${relativeTime(this.values[Keys.fetcherLastDeviceUpdatedMs] / 1000)}</li>
            <li>Ticks since start: ${this.values[Keys.fetcherNumTicks]}</li>
            <li>Ticks: ${this.values[Keys.fetcherLastTicksSec].map((t: number) => relativeTime(t)).join(', ')}</li>

            <li style="padding-top: .5em">
              Fetcher first started: ${relativeTime(this.values[Keys.fetcherStartedSec])}
            </li>
            <li>Fetcher last started: ${relativeTime(this.values[Keys.fetcherReStartedSec])}</li>
            <li>Fetcher num starts: ${this.values[Keys.fetcherNumStarts]}</li>
            <li>Fetcher last stopped: ${lastStopSec == 0 ? '-' : relativeTime(lastStopSec)}</li>
            <li>Fetcher next stop: ${nextStopSec == 0 ? '-' : relativeTime(nextStopSec)}</li>

            <li style="padding-top: .5em">Memory RSS: ${this.values[Keys.fetcherMemoryRssMb]}MB</li>
            <li>Memory Heap: ${this.values[Keys.fetcherMemoryHeapMb]}MB</li>
            <li>
              Host memory:
              ${Math.round(this.values[Keys.hostMemoryUsedMb])}/${Math.round(this.values[Keys.hostMemoryTotalMb])}MB
            </li>
            <li>Host CPU: ${Math.round(this.values[Keys.hostCpuUsage])}%</li>
            <li>Uptime: ${relativeTime(this.values[Keys.hostUptimeSec], 0)}</li>
          </ul>
          <ul style="padding-top: .5em">
            <li>Uploaded tracks: ${this.values[Keys.trackNum]}</li>
          </ul>
          <ul style="padding-top: .5em">
            <li class="has-text-grey">Data age: ${relativeTime(lastFetchMs / 1000)}</li>
          </ul>
          <div class="buttons" style="margin-top: .5rem">
            <button
              class=${`button is-success is-small ${when(this.isLoading, () => 'is-loading')}`}
              @click=${() => this.dispatchEvent(new CustomEvent('sync'))}
            >
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
    const oldAfterSec = 24 * 3 * 3600;
    const number = this.values[Keys.trackerNumByType.replace('{name}', this.name)];
    const durations = this.values[Keys.trackerFetchDuration.replace('{name}', this.name)];
    const numDevices = this.values[Keys.trackerNumFetches.replace('{name}', this.name)];
    const numUpdates = this.values[Keys.trackerNumUpdates.replace('{name}', this.name)];

    const topErrors = this.values[Keys.trackerManyErrorsById.replace('{name}', this.name)];
    const { recent: topRecentErrorsById, old: topOldErrorsById } = splitByDate(topErrors, oldAfterSec);

    const consErrors = this.values[Keys.trackerConsecutiveErrorsById.replace('{name}', this.name)];
    const { recent: consRecentErrorsById, old: consOldErrorsById } = splitByDate(consErrors, oldAfterSec);

    const errorsById = this.values[Keys.trackerErrorsById.replace('{name}', this.name)];
    const { recent: recentErrorsById, old: oldErrorsById } = splitByDate(errorsById, oldAfterSec);

    const errors = this.values[Keys.trackerErrorsByType.replace('{name}', this.name)];
    const { recent: recentErrors, old: oldErrors } = splitByDate(errors, oldAfterSec);

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>${this.name}</p>
        </div>
        <div class="panel-block">
          <ul>
            <li><a href=${GQL_URL.replace('{name}', this.name)} target="_blank">Trackers: ${number}</a></li>
            <li>Duration (sec): ${durations.join(', ')}</li>
            <li>Devices fetched: ${numDevices.join(', ')}</li>
            <li>Devices updated: ${numUpdates.join(', ')}</li>
          </ul>
          ${errorMarkup('Top errors', topRecentErrorsById, topOldErrorsById)}
          ${errorMarkup('Consecutive errors', consRecentErrorsById, consOldErrorsById)}
          ${errorMarkup('Device errors', recentErrorsById, oldErrorsById)}
          ${errorMarkup('Tracker level errors', recentErrors, oldErrors)}
        </div>
      </div>`;
  }
}

function errorMarkup(title: string, recent: string[], old: string[]): TemplateResult {
  if (recent.length == 0 && old.length == 0) {
    return html`<p style="padding-top: .5em">No ${title.toLowerCase()}</p>`;
  }
  return html`<p style="padding-top: .5em"><strong>${title}</strong></p>
    <ul>
      ${recent.map((e) => html`<li>${unsafeHTML(e)}</li>`)}
    </ul>
    ${old.length > 0
      ? html`<details>
          <summary>Old</summary>
          <ul>
            ${old.map((e) => html`<li>${unsafeHTML(e)}</li>`)}
          </ul>
        </details>`
      : null}`;
}

@customElement('dash-elev')
export class DashElevation extends LitElement {
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
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>Elevation</p>
        </div>
        <div class="panel-block">
          <ul>
            <li>Num fetched: ${this.values[Keys.elevationNumFetched].join(', ')}</li>
            <li>Num Retrieved: ${this.values[Keys.elevationNumRetrieved].join(', ')}</li>
            ${this.values[Keys.elevationErrors].map((e: string) => html`<li>${formatLogEntry(e)}</li>`)}
          </ul>
        </div>
      </div>`;
  }
}

@customElement('dash-sync')
export class DashSync extends LitElement {
  @property({ attribute: false })
  values: any;

  @state()
  private btnLoading = {
    [Keys.fetcherCmdExportFile]: false,
    [Keys.fetcherCmdSyncFull]: false,
  };

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
    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>Sync and Export</p>
        </div>
        <div class="panel-block">
          <p><strong>Full sync</strong></p>
          <ul>
            <li>Next: ${relativeTime(this.values[Keys.fetcherNextFullSyncSec])}</li>
            <li>
              Last num sync:
              ${this.values[Keys.stateSyncNum.replace('{type}', 'full')]
                .map((e: string) => formatLogEntry(e))
                .join(', ')}
            </li>
            <li>
              Last errors:
              ${this.values[Keys.stateSyncErrors.replace('{type}', 'full')]
                .map((e: string) => formatLogEntry(e))
                .join(', ')}
            </li>
          </ul>
          <p style="padding-top: .5em"><strong>Partial sync</strong></p>
          <ul>
            <li>Next: ${relativeTime(this.values[Keys.fetcherNextPartialSyncSec])}</li>
            <li>
              Last num sync:
              ${this.values[Keys.stateSyncNum.replace('{type}', 'inc')]
                .map((e: string) => formatLogEntry(e))
                .join(', ')}
            </li>
            <li>
              Last errors:
              ${this.values[Keys.stateSyncErrors.replace('{type}', 'inc')]
                .map((e: string) => formatLogEntry(e))
                .join(', ')}
            </li>
          </ul>
          <p style="padding-top: .5em"><strong>Export</strong></p>
          <ul>
            <li>Next: ${relativeTime(this.values[Keys.fetcherNextExportSec])}</li>
            ${this.values[Keys.stateExportStatus].map((e: string) => html`<li>${formatLogEntry(e)}</li>`)}
          </ul>
          <div class="buttons" style="margin-top: .5rem">
            <button
              class=${`button is-success is-small ${when(
                this.btnLoading[Keys.fetcherCmdSyncFull],
                () => 'is-loading',
              )}`}
              @click=${async () => await this.sendCommand(Keys.fetcherCmdSyncFull)}
            >
              <i class="la la-sync la-2x"></i> Sync
            </button>
            <a
              class=${`button is-success is-small ${when(
                this.btnLoading[Keys.fetcherCmdExportFile],
                () => 'is-loading',
              )}`}
              @click=${async () => await this.sendCommand(Keys.fetcherCmdExportFile)}
              ><i class="la la-cloud-upload-alt la-2x"></i> Export</a
            >
          </div>
        </div>
      </div>`;
  }

  // Send a state command.
  private async sendCommand(command: Keys.fetcherCmdSyncFull | Keys.fetcherCmdExportFile) {
    if (this.btnLoading[command]) {
      return;
    }
    this.btnLoading = { ...this.btnLoading, [command]: true };
    await fetch(`/admin/_state/cmd/${command}`, { method: 'POST', credentials: 'include' });
    setInterval(() => {
      this.btnLoading = { ...this.btnLoading, [command]: false };
    }, 5000);
  }
}

const STATE_MAX_PILOT = 50;

@customElement('state-explorer')
export class StateExplorer extends LitElement {
  @state()
  private isLoading = false;

  @state()
  private filter = '';

  @state()
  private fetcherState?: FetcherState;

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
      json-viewer {
        font-size: 0.8rem;
      }
    `;
  }

  disconnectedCallback(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  render(): TemplateResult {
    const state: any = filterState(this.fetcherState, STATE_MAX_PILOT, this.filter);
    const numMatchingPilots = state.numMatchingPilots ?? 0;

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />

      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>State Explorer</p>
        </div>
        <div class="panel-block">
          <div class="buttons" style="margin-top: .5em">
            <button
              class=${`button is-success is-small ${when(this.isLoading, () => 'is-loading')}`}
              @click=${async () => this.fetchState()}
            >
              <i class="la la-cloud-download-alt la-2x"></i> Fetch
            </button>
          </div>
          ${when(
            this.fetcherState,
            () => html`<div class="field">
                <label class="label">Filter</label>
                <div class="control has-icons-left">
                  <input class="input" type="text" .value="${this.filter}" @input="${this.onFilterInput}" />
                  <span class="icon is-left">
                    <i class="la la-filter la-2x"></i>
                  </span>
                </div>
                <p class="help">
                  ${numMatchingPilots} pilots.
                  ${when(numMatchingPilots > STATE_MAX_PILOT, () => `Only first ${STATE_MAX_PILOT} shown.`)}
                </p>
              </div>
              <json-viewer .data=${state}>{}</json-viewer>`,
          )}
        </div>
      </div>`;
  }

  private onFilterInput(e: InputEvent) {
    this.filter = (e.target as HTMLInputElement).value;
  }

  private async fetchState() {
    if (this.isLoading) {
      return;
    }
    this.fetcherState = undefined;
    this.isLoading = true;
    await fetch(`/admin/_state/cmd/${Keys.fetcherCmdCaptureState}`, { method: 'POST', credentials: 'include' });
    const deadline = Date.now() + 2 * 60 * 1000;
    this.timer = setInterval(async () => {
      const response = await fetch('/admin/_state.json', { credentials: 'include' });
      if (response.status == 200) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        this.fetcherState = FetcherState.fromBinary(buffer);
        this.isLoading = false;
        clearInterval(this.timer);
        this.timer = null;
        // Force an update of the JSON viewer.
        setTimeout(() => this.requestUpdate(), 100);
        return;
      }
      if (Date.now() > deadline) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 10 * 1000);
  }
}

// Returns readable relative time.
function relativeTime(timeSec: number, relativeToSec = Math.round(Date.now() / 1000)): string {
  const delta = timeSec - relativeToSec;
  if (Math.abs(delta) >= 24 * 3600 * 365) {
    return `${round(delta / (24 * 3600 * 365), 1)}y`;
  }
  if (Math.abs(delta) >= 24 * 3600 * 30) {
    return `${round(delta / (24 * 3600 * 30), 1)}month`;
  }
  if (Math.abs(delta) >= 24 * 3600 * 7) {
    return `${round(delta / (24 * 3600 * 7), 1)}w`;
  }
  if (Math.abs(delta) >= 24 * 3600) {
    return `${round(delta / (24 * 3600), 1)}d`;
  }
  if (Math.abs(delta) >= 3600) {
    return `${round(delta / 3600, 1)}h`;
  }
  if (Math.abs(delta) >= 60) {
    return `${round(delta / 60, 0)}min`;
  }
  return `${round(delta, 0)}s`;
}

// Formats logs entry of the shape:
// - "[timeSec] id=<> message",
// - "[timeSec] message".
function formatLogEntry(entry: string): string {
  const mId = entry.match(/\[(\d+)\] id=(\d+) (.*)/i);
  if (mId) {
    const timeSec = Number(mId[1]);
    const id = mId[2];
    return `[${relativeTime(timeSec)}] <a href=${entityHref(id)} target="_blank">${id}</a> ${mId[3]}`;
  }
  const m = entry.match(/\[(\d+)\] (.*)/i);
  if (m) {
    const timeSec = Number(m[1]);
    return `[${relativeTime(timeSec)}] ${m[2]}`;
  }
  return entry;
}

// Returns the timestamp from a log entry or now.
function getLogDateSec(entry: string): number {
  const m = entry.match(/\[(\d+)\] (.*)/i);
  if (m) {
    const timeSec = Number(m[1]);
    return timeSec;
  }
  return Math.round(Date.now() / 1000);
}

// Split lot entries  before/after the split.
function splitByDate(entries: string[], splitSec: number) {
  const recent: string[] = [];
  const old: string[] = [];
  const before = Math.round(Date.now() / 1000) - splitSec;
  for (const entry of entries) {
    if (getLogDateSec(entry) > before) {
      recent.push(formatLogEntry(entry));
    } else {
      old.push(formatLogEntry(entry));
    }
  }
  return { recent, old };
}

// Link to the account editor.
function entityHref(id: string) {
  return `/admin/account/${id}`;
}

// Format the app state to a shorter and more understandable form for display.
function filterState(state: FetcherState | undefined, maxPilots: number, filter: string): unknown {
  if (state == null) {
    return {};
  }

  const tickSec = state.lastTickSec;
  const output: any = {
    version: state.version,
    numTicks: state.numTicks,
    numStarts: state.numStarts,
    startedSec: relativeTime(state.startedSec, tickSec),
    reStartedSec: relativeTime(state.reStartedSec, tickSec),
    stoppedSec: relativeTime(state.stoppedSec, tickSec),
    lastTickSec: relativeTime(state.lastTickSec, tickSec),
    lastUpdatedMs: `${state.lastUpdatedMs}ms (${relativeTime(state.lastUpdatedMs / 1000, tickSec)})`,
    nextPartialSyncSec: relativeTime(state.nextPartialSyncSec, tickSec),
    nextFullSyncSec: relativeTime(state.nextFullSyncSec, tickSec),
    nextExportSec: relativeTime(state.nextExportSec, tickSec),
    numMatchingPilots: 0,
    pilots: [],
  };

  let numMatchingPilots = 0;

  for (const [pId, pilot] of Object.entries(state.pilots)) {
    if (!pilotMatches(pilot, filter)) {
      continue;
    }

    numMatchingPilots++;

    if (pilot.enabled === false) {
      output.pilots.push({ name: pilot.name, id: pId, tracking: false });
      continue;
    }

    const outPilot: any = {
      name: pilot.name,
      id: pId,
      share: pilot.share,
      track: pilot.track,
    };

    let lastFixSec = 0;

    for (const tId of Object.values(trackerPropNames)) {
      const tracker: Tracker | undefined = (pilot as any)[tId];
      if (tracker == null || tracker.enabled == false) {
        outPilot[tId] = 'Tracker disabled';
        continue;
      }

      lastFixSec = Math.max(lastFixSec, tracker.lastFixSec);

      outPilot[tId] = {
        account: tracker.account,
        lastFetchSec: relativeTime(tracker.lastFetchSec, tickSec),
        lastFixSec: relativeTime(tracker.lastFixSec, tickSec),
        nextFetchSec: relativeTime(tracker.nextFetchSec, tickSec),
        numErrors: tracker.numErrors,
        numRequest: tracker.numRequests,
        numConsecutiveErrors: tracker.numConsecutiveErrors,
      };
    }

    if (lastFixSec > 0) {
      outPilot.lastFixSec = lastFixSec;
    }

    output.pilots.push(outPilot);
  }

  // Sort pilots with the last updated first.
  output.pilots.sort((pa: any, pb: any) => {
    const lastFixA = pa.lastFixSec ?? 0;
    const lastFixB = pb.lastFixSec ?? 0;
    return lastFixB - lastFixA;
  });

  output.pilots.forEach((p: any) => {
    if (p.lastFixSec != null) {
      p.lastFixSec = relativeTime(p.lastFixSec, tickSec);
    }
  });

  output.pilots.splice(maxPilots);

  output.numMatchingPilots = numMatchingPilots;

  return output;
}

// Returns whether a pilot matches the filter.
function pilotMatches(pilot: Pilot, filter: string): boolean {
  if (filter.length == 0) {
    return true;
  }
  const regexp = new RegExp(filter, 'i');

  let match = regexp.test(pilot.name);

  for (const tId of Object.values(trackerPropNames)) {
    match ||= regexp.test((pilot as any)[tId].account);
  }

  return match;
}
