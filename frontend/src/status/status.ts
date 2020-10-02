import { css, CSSResult, customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';

@customElement('flyxc-status')
export class FlyXcStatusElement extends LitElement {
  @internalProperty()
  private status: any;

  @internalProperty()
  private timestamp = 0;

  private fetchId: any;
  private readonly visibilityListener = () => this.handleVisibility();

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
    this.visibilityListener();
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.visibilityListener);
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
        <li>last request: ${lastRequest.toLocaleDateString()} ${lastRequest.toLocaleTimeString()}</li>
        <li>
          last refresh: ${this.status['num-refresh']} trackers on ${lastRefresh.toLocaleDateString()}
          ${lastRefresh.toLocaleTimeString()}
        </li>
        <li>
          active trackers ${this.status['active-trackers']}/${this.status.trackers} (${this.status.noDeviceTrackers} not
          activated)
        </li>
        <li>tracks ${this.status.tracks}</li>
      </ul>
    `;
  }

  protected handleVisibility(): void {
    const visible = document.visibilityState == 'visible';
    if (visible) {
      if (this.fetchId == null) {
        this.fetchStatus();
        this.fetchId = setInterval(() => this.fetchStatus(), 2 * 60 * 1000);
      }
    } else {
      if (this.fetchId != null) {
        clearInterval(this.fetchId);
        this.fetchId = null;
      }
    }
  }

  private fetchStatus(): void {
    fetch('/_status.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (status) {
          this.status = status;
          this.timestamp = Date.now();
        }
      });
  }
}
