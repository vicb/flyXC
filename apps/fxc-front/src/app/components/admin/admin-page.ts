import '@alenaksu/json-viewer';
import * as common from '@flyxc/common';
import { html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import '../ui/google-btn';

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

@customElement('admin-page')
export class AdminPage extends LitElement {
  @state()
  private isLoading = true;

  @state()
  private connected = false;

  @state()
  private values: unknown;

  private timer: any;

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
    return html`<style>
        ion-item {
          --min-height: 0px;
          font-size: 0.9rem;
        }
        ion-item ion-text.value {
          padding-left: 0.3em;
        }
        ion-label {
          margin: 0;
        }
        json-viewer {
          --font-size: 0.8rem;
          margin: 0 10px;
        }
      </style>

      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>FlyXC admin</ion-title>
          <ion-title size="small">Dashboard</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        ${when(!this.connected, () => html`<google-btn callback="/adm" style="margin-top: 10px"></google-btn>`)}
        ${when(this.isLoading && !this.values, () => html`<ion-progress-bar type="indeterminate"></ion-progress-bar>`)}
        ${when(
          this.values,
          () => html`<dash-summary .values=${this.values} @sync=${this.fetch}></dash-summary>
            ${common.trackerNames.map(
              (name) => html`<dash-tracker .values=${this.values} .name=${name}></dash-tracker>`,
            )}
            ${common.ufoFleetNames.map((name) => html`<dash-fleet .values=${this.values} .name=${name}></dash-fleet>`)}
            <dash-proxy .values=${this.values}></dash-proxy>
            <dash-elev .values=${this.values}></dash-elev>
            <dash-sync .values=${this.values}></dash-sync>
            <state-explorer></state-explorer>`,
        )}
      </ion-content>
      <ion-footer>
        <ion-toolbar color="light">
          <ion-buttons slot="primary">
            <ion-button @click=${this.fetch}>Refresh</ion-button>
          </ion-buttons>
          <ion-buttons slot="secondary">
            <ion-button href="/api/live/logout">Logout</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>`;
  }

  private fetch() {
    this.isLoading = true;
    lastFetchMs = Date.now();
    fetch(`/api/admin/admin.json`).then(async (response) => {
      this.isLoading = false;
      this.connected = response.ok;
      if (response.ok) {
        this.values = await response.json();
      }
    });
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('dash-summary')
export class DashSummary extends LitElement {
  @property({ attribute: false })
  values: any;

  private link?: HTMLLinkElement;
  private timer: any;

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
    const trackerH1 = this.values[common.Keys.fetcherIncrementalNumTracks];
    const nextStopSec = this.values[common.Keys.fetcherNextStopSec];
    const lastStopSec = this.values[common.Keys.fetcherStoppedSec];

    if (this.link) {
      this.link.href = `data:image/svg+xml;base64,${btoa(FAVICON_SVG(trackerH1))}`;
    }
    return html`<link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <ion-card>
        <ion-card-header color="secondary">
          <ion-card-title><i class="las la-heartbeat"></i> Fetcher</ion-card-title>
        </ion-card-header>
        ${singleLineItem(
          'Trackers',
          this.values[common.Keys.trackerNum],
          'https://console.cloud.google.com/datastore/entities;kind=LiveTrack;ns=__$DEFAULT$__;sortCol=created;sortDir=DESCENDING/query/kind?project=fly-xc',
        )}
        ${singleLineItem('Trackers h24', this.values[common.Keys.fetcherFullNumTracks])}
        ${singleLineItem('Trackers h1', trackerH1)}
        ${singleLineItem(
          'Last device updated',
          relativeTime(this.values[common.Keys.fetcherLastDeviceUpdatedMs] / 1000),
        )}
        ${singleLineItem('Ticks since start', this.values[common.Keys.fetcherNumTicks])}
        ${singleLineItem(
          'Ticks',
          this.values[common.Keys.fetcherLastTicksSec].map((t: number) => relativeTime(t)).join(', '),
        )}
        ${singleLineItem('Fetcher first started', relativeTime(this.values[common.Keys.fetcherStartedSec]))}
        ${singleLineItem('Fetcher last started', relativeTime(this.values[common.Keys.fetcherReStartedSec]))}
        ${singleLineItem('Fetcher num starts', this.values[common.Keys.fetcherNumStarts])}
        ${singleLineItem('Fetcher last stopped', lastStopSec == 0 ? '-' : relativeTime(lastStopSec))}
        ${singleLineItem('Fetcher next stop', nextStopSec == 0 ? '-' : relativeTime(nextStopSec))}
        ${singleLineItem('Memory RSS', `${this.values[common.Keys.fetcherMemoryRssMb]}MB`)}
        ${singleLineItem('Memory Heap', `${this.values[common.Keys.fetcherMemoryHeapMb]}MB`)}
        ${singleLineItem(
          'Host memory',
          `${Math.round(this.values[common.Keys.hostMemoryUsedMb])}/${Math.round(
            this.values[common.Keys.hostMemoryTotalMb],
          )}MB`,
        )}
        ${singleLineItem('Host CPU', `${Math.round(this.values[common.Keys.hostCpuUsage])}%`)}
        ${singleLineItem('Node', `${this.values[common.Keys.hostNode]}`)}
        ${singleLineItem('Uptime', relativeTime(this.values[common.Keys.hostUptimeSec], 0))}
        ${singleLineItem('Uploaded tracks', this.values[common.Keys.trackNum])}
        ${singleLineItem('Data age', relativeTime(lastFetchMs / 1000))}
      </ion-card>`;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('dash-tracker')
export class DashTracker extends LitElement {
  @property({ attribute: false })
  values: any;

  @property({ attribute: false })
  name!: common.TrackerNames;

  private label = '';

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('name')) {
      this.label = common.trackerDisplayNames[this.name];
    }
  }

  render(): TemplateResult {
    const oldAfterSec = 24 * 3 * 3600;
    const number = this.values[common.Keys.trackerNumByType.replace('{name}', this.name)];
    const durations = this.values[common.Keys.trackerFetchDuration.replace('{name}', this.name)];
    const numDevices = this.values[common.Keys.trackerNumFetches.replace('{name}', this.name)];
    const numUpdates = this.values[common.Keys.trackerNumUpdates.replace('{name}', this.name)];

    const topErrors = this.values[common.Keys.trackerManyErrorsById.replace('{name}', this.name)];
    const { recent: topRecentErrorsById, old: topOldErrorsById } = splitByDate(topErrors, oldAfterSec);

    const consErrors = this.values[common.Keys.trackerConsecutiveErrorsById.replace('{name}', this.name)];
    const { recent: consRecentErrorsById, old: consOldErrorsById } = splitByDate(consErrors, oldAfterSec);

    const errorsById = this.values[common.Keys.trackerErrorsById.replace('{name}', this.name)];
    const { recent: recentErrorsById, old: oldErrorsById } = splitByDate(errorsById, oldAfterSec);

    const errors = this.values[common.Keys.trackerErrorsByType.replace('{name}', this.name)];
    const { recent: recentErrors, old: oldErrors } = splitByDate(errors, oldAfterSec);

    return html`
      <ion-card>
        <ion-card-header color="secondary">
          <ion-card-title><i class="las la-calculator"></i> ${this.label}</ion-card-title>
        </ion-card-header>

        ${singleLineItem('Trackers', number, GQL_URL.replace('{name}', this.name))}
        ${item('Duration (sec)', durations.join(', '))} ${item('Devices fetched', numDevices.join(', '))}
        ${item('Devices updated', numUpdates.join(', '))}
        <ion-accordion-group
          .multiple=${true}
          .value=${['Top errors', 'Consecutive errors', 'Device errors', 'Tracker level errors']}
        >
          ${errorMarkup('Top errors', topRecentErrorsById, topOldErrorsById)}
          ${errorMarkup('Consecutive errors', consRecentErrorsById, consOldErrorsById)}
          ${errorMarkup('Device errors', recentErrorsById, oldErrorsById)}
          ${errorMarkup('Tracker level errors', recentErrors, oldErrors)}
        </ion-accordion-group>
      </ion-card>
    `;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('dash-fleet')
export class DashFleet extends LitElement {
  @property({ attribute: false })
  values: any;

  @property({ attribute: false })
  name!: common.UfoFleetNames;

  private label = '';

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('name')) {
      this.label = common.ufoFleetDisplayNames[this.name];
    }
  }

  render(): TemplateResult {
    const oldAfterSec = 24 * 3 * 3600;
    const durations = this.values[common.Keys.trackerFetchDuration.replace('{name}', this.name)];
    const numUpdates = this.values[common.Keys.trackerNumUpdates.replace('{name}', this.name)];

    const errors = this.values[common.Keys.trackerErrorsByType.replace('{name}', this.name)];
    const { recent: recentErrors, old: oldErrors } = splitByDate(errors, oldAfterSec);

    return html`
      <ion-card>
        <ion-card-header color="secondary">
          <ion-card-title><i class="las la-plane"></i> ${this.label}</ion-card-title>
        </ion-card-header>

        ${item('Duration (sec)', durations.join(', '))} ${item('Devices updated', numUpdates.join(', '))}
        <ion-accordion-group .multiple=${true} .value=${['Errors']}>
          ${errorMarkup('Errors', recentErrors, oldErrors)}
        </ion-accordion-group>
      </ion-card>
    `;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

function errorMarkup(title: string, recent: string[], old: string[]): TemplateResult {
  return html`${when(
    recent.length > 0,
    () => html`<ion-accordion .value=${title}>
      <ion-item slot="header">
        <ion-label>${title} (${recent.length})</ion-label>
      </ion-item>
      <ion-list slot="content">
        ${recent.map(
          (e) => html`<ion-item lines="none">
            <ion-label>${unsafeHTML(e)}</ion-label>
          </ion-item>`,
        )}
      </ion-list>
    </ion-accordion>`,
  )}
  ${when(
    old.length > 0,
    () => html`<ion-accordion>
      <ion-item slot="header">
        <ion-label>Old ${title} (${old.length})</ion-label>
      </ion-item>
      <ion-list slot="content">
        ${old.map(
          (e) => html`<ion-item lines="none">
            <ion-label>${unsafeHTML(e)}</ion-label>
          </ion-item>`,
        )}
      </ion-list>
    </ion-accordion>`,
  )}`;
}

@customElement('dash-elev')
export class DashElevation extends LitElement {
  @property({ attribute: false })
  values: any;

  render(): TemplateResult {
    return html`<ion-card>
      <ion-card-header color="secondary">
        <ion-card-title><i class="las la-mountain"></i> Elevation</ion-card-title>
      </ion-card-header>

      ${item('Num fetched', this.values[common.Keys.elevationNumFetched].join(', '))}
      ${item('Num Retrieved', this.values[common.Keys.elevationNumRetrieved].join(', '))}
      ${this.values[common.Keys.elevationErrors].map((e: string) => item(formatLogEntry(e)))}
    </ion-card>`;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('dash-proxy')
export class DashProxy extends LitElement {
  @property({ attribute: false })
  values: any;

  render(): TemplateResult {
    return html`<ion-card>
      <ion-card-header color="secondary">
        <ion-card-title><i class="las la-forward"></i> Proxy</ion-card-title>
      </ion-card-header>

      ${this.values[common.Keys.proxyInreach].map((e: string) => item(formatLogEntry(e)))}
    </ion-card>`;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

@customElement('dash-sync')
export class DashSync extends LitElement {
  @property({ attribute: false })
  values: any;

  @state()
  private btnLoading = {
    [common.Keys.fetcherCmdExportFile]: false,
    [common.Keys.fetcherCmdSyncFull]: false,
  };

  render(): TemplateResult {
    return html`<ion-card>
      <ion-card-header color="secondary">
        <ion-card-title><i class="las la-sync"></i> Sync and Export</ion-card-title>
      </ion-card-header>

      <ion-item-divider color="light">
        <ion-label>Full sync</ion-label>
      </ion-item-divider>

      ${singleLineItem('Next', relativeTime(this.values[common.Keys.fetcherNextFullSyncSec]))}
      ${item(
        'Last num sync',
        this.values[common.Keys.stateSyncNum.replace('{type}', 'full')]
          .map((e: string) => formatLogEntry(e))
          .join(', '),
      )}
      ${item(
        'Last errors',
        this.values[common.Keys.stateSyncErrors.replace('{type}', 'full')]
          .map((e: string) => formatLogEntry(e))
          .join(', '),
      )}

      <ion-item-divider color="light">
        <ion-label>Partial sync</ion-label>
      </ion-item-divider>

      ${singleLineItem('Next', relativeTime(this.values[common.Keys.fetcherNextPartialSyncSec]))}
      ${item(
        'Last num sync',
        this.values[common.Keys.stateSyncNum.replace('{type}', 'inc')].map((e: string) => formatLogEntry(e)).join(', '),
      )}
      ${item(
        'Last errors',
        this.values[common.Keys.stateSyncErrors.replace('{type}', 'inc')]
          .map((e: string) => formatLogEntry(e))
          .join(', '),
      )}

      <ion-item-divider color="light">
        <ion-label>Export</ion-label>
      </ion-item-divider>

      ${singleLineItem('Next', relativeTime(this.values[common.Keys.fetcherNextExportSec]))}
      ${this.values[common.Keys.stateExportStatus].map((e: string) => item(formatLogEntry(e)))}

      <ion-item lines="none">
        <ion-button
          .disabled=${this.btnLoading[common.Keys.fetcherCmdSyncFull]}
          @click=${async () => await this.sendCommand(common.Keys.fetcherCmdSyncFull)}
          ><i class=${`la la-sync ${when(this.btnLoading[common.Keys.fetcherCmdSyncFull], () => 'la-spin')}`}></i>
          Sync</ion-button
        >
        <ion-button
          .disabled=${this.btnLoading[common.Keys.fetcherCmdExportFile]}
          @click=${async () => await this.sendCommand(common.Keys.fetcherCmdExportFile)}
          ><i
            class=${`la la-cloud-upload-alt ${when(
              this.btnLoading[common.Keys.fetcherCmdExportFile],
              () => 'la-spin',
            )}`}
          ></i>
          Export</ion-button
        >
      </ion-item>
    </ion-card>`;
  }

  // Send a state command.
  private async sendCommand(command: common.Keys.fetcherCmdSyncFull | common.Keys.fetcherCmdExportFile) {
    if (this.btnLoading[command]) {
      return;
    }
    this.btnLoading = { ...this.btnLoading, [command]: true };
    await fetch(`/api/admin/state/cmd/${command}`, { method: 'POST', credentials: 'include' });
    setInterval(() => {
      this.btnLoading = { ...this.btnLoading, [command]: false };
    }, 5000);
  }

  createRenderRoot(): HTMLElement {
    return this;
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
  private fetcherState?: common.protos.FetcherState;

  private fetchTimer: any;
  private refreshTimer: any;
  private fetchSec = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.fetchState();
    this.refreshTimer = setInterval(() => {
      this.requestUpdate();
    }, 10 * 1000);
  }

  disconnectedCallback(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  render(): TemplateResult {
    const state: any = filterState(this.fetcherState, STATE_MAX_PILOT, this.filter);
    const numMatchingPilots = state.numMatchingPilots ?? 0;

    return html` <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />

      <ion-card>
        <ion-card-header color="secondary">
          <ion-card-title><i class="las la-table"></i> State Explorer</ion-card-title>
        </ion-card-header>
        <ion-item lines="none">
          <ion-button .disabled=${this.isLoading} @click=${async () => await this.fetchState()}
            ><i class=${`la la-sync ${when(this.isLoading, () => 'la-spin')}`}></i> Sync</ion-button
          >
        </ion-item>
        ${when(
          this.fetcherState,
          () => html`<ion-item lines="none">
              <ion-input
                label="Filter..."
                label-placement="floating"
                @input=${this.onFilterInput}
                type="text"
                .value=${this.filter}
                .clearInput=${true}
              ></ion-input>
            </ion-item>
            ${item(
              `${numMatchingPilots} pilots. ${
                numMatchingPilots > STATE_MAX_PILOT ? `Only first ${STATE_MAX_PILOT} shown.` : ``
              }`,
            )}
            <json-viewer .data=${state}>{}</json-viewer>
            ${singleLineItem('State age', relativeTime(Date.now() / 1000, this.fetchSec))}`,
        )}
      </ion-card>`;
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
    await fetch(`/api/admin/state/cmd/${common.Keys.fetcherCmdCaptureState}`, {
      method: 'POST',
      credentials: 'include',
    });
    const deadline = Date.now() + 2 * 60 * 1000;
    this.fetchTimer = setInterval(async () => {
      const response = await fetch('/api/admin/state.pbf', { credentials: 'include' });
      if (response.status == 200) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        this.fetcherState = common.protos.FetcherState.fromBinary(buffer);
        this.isLoading = false;
        clearInterval(this.fetchTimer);
        this.fetchTimer = null;
        this.fetchSec = Math.round(Date.now() / 1000);
        // Force an update of the JSON viewer.
        setTimeout(() => this.requestUpdate(), 100);
        return;
      }
      if (Date.now() > deadline) {
        clearInterval(this.fetchTimer);
        this.fetchTimer = null;
      }
    }, 10 * 1000);
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

function singleLineItem(key: string, value: any, valueLink?: string) {
  return html`<ion-item lines="none">
    <ion-text color="medium">${unsafeHTML(key)}</ion-text>
    <ion-text class="value" color="dark"
      >${when(
        valueLink,
        () => html`<a href=${valueLink ?? ''} target="_blank">${unsafeHTML(value)}</a>`,
        () => unsafeHTML(value),
      )}</ion-text
    >
  </ion-item>`;
}

function item(key: string, value?: any) {
  return html`<ion-item lines="none">
    <ion-label>
      <p>${unsafeHTML(key)}</p>
      ${when(value, () => html`<h3>${unsafeHTML(value)}</h3>`)}
    </ion-label>
  </ion-item>`;
}

// Returns readable relative time.
function relativeTime(timeSec: number, relativeToSec = Math.round(Date.now() / 1000)): string {
  const delta = timeSec - relativeToSec;
  if (Math.abs(delta) >= 24 * 3600 * 365) {
    return `${common.round(delta / (24 * 3600 * 365), 1)}y`;
  }
  if (Math.abs(delta) >= 24 * 3600 * 30) {
    return `${common.round(delta / (24 * 3600 * 30), 1)}month`;
  }
  if (Math.abs(delta) >= 24 * 3600 * 7) {
    return `${common.round(delta / (24 * 3600 * 7), 1)}w`;
  }
  if (Math.abs(delta) >= 24 * 3600) {
    return `${common.round(delta / (24 * 3600), 1)}d`;
  }
  if (Math.abs(delta) >= 3600) {
    return `${common.round(delta / 3600, 1)}h`;
  }
  if (Math.abs(delta) >= 60) {
    return `${common.round(delta / 60, 0)}min`;
  }
  return `${common.round(delta, 0)}s`;
}

// Formats logs entry of the shape:
// - "[timeSec] id=<> message",
// - "[timeSec] message".
function formatLogEntry(entry: string): string {
  const mId = entry.match(/\[(\d+)\] id=(\d+) ([\s\S]*)/i);
  if (mId) {
    const timeSec = Number(mId[1]);
    const id = mId[2];
    return `[${relativeTime(timeSec)}] <a href=${entityHref(id)} target="_blank">${id}</a> ${mId[3]}`;
  }
  const m = entry.match(/\[(\d+)\] ([\s\S]*)/i);
  if (m) {
    const timeSec = Number(m[1]);
    return `[${relativeTime(timeSec)}] ${m[2]}`;
  }
  return entry;
}

// Returns the timestamp from a log entry or now.
function getLogDateSec(entry: string): number {
  const m = entry.match(/\[(\d+)\] ([\s\S]*)/i);
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
  return `/adm/account/${id}`;
}

// Format the app state to a shorter and more understandable form for display.
function filterState(state: common.protos.FetcherState | undefined, maxPilots: number, filter: string): unknown {
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
    fleet: [],
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

    for (const tId of common.trackerNames) {
      const tracker: common.protos.Tracker | undefined = pilot[tId];
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

  output.fleet = state.ufoFleets;

  return output;
}

// Returns whether a pilot matches the filter.
function pilotMatches(pilot: common.protos.Pilot, filter: string): boolean {
  if (filter.length == 0) {
    return true;
  }
  const regexp = new RegExp(filter, 'i');

  let match = regexp.test(pilot.name);

  for (const tracker of common.trackerNames) {
    match ||= regexp.test(pilot[tracker]?.account ?? '');
  }

  return match;
}
