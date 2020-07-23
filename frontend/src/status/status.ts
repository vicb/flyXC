import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';

@customElement('flyxc-status')
export class FlyXcStatusElement extends LitElement {
  @internalProperty()
  status: any = null;

  @internalProperty()
  timestamp: number | null = null;

  constructor() {
    super();
    this.fetchStatus();
    setInterval(() => this.fetchStatus(), 60 * 1000);
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

  fetchStatus(): void {
    fetch('/_status.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (status) {
          this.status = status;
          this.timestamp = Date.now();
        }
      });
  }

  render(): TemplateResult {
    if (!this.status) {
      return html``;
    }
    const lastRequest = new Date(this.status['last-request']);
    const lastRefresh = new Date(this.status['last-refresh']);
    const lastStatus = new Date(this.timestamp || 0);

    return html`
      <h1>Status</h1>
      <ul>
        <li>on ${lastStatus.toLocaleDateString()} ${lastStatus.toLocaleTimeString()}</li>
        <li>
          last request: ${lastRequest.toLocaleDateString()} ${lastRequest.toLocaleTimeString()}
        </li>
        <li>
          last refresh: ${this.status['num-refresh']} trackers on ${lastRefresh.toLocaleDateString()}
          ${lastRefresh.toLocaleTimeString()}
        </li>
        <li>
          active trackers ${this.status['active-trackers']}/${this.status.trackers} (${this.status.unactivatedTrackers}
          not activated)
        </li>
        <li>tracks ${this.status.tracks}</li>
      </ul>
    `;
  }
}
