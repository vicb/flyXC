// Editor for user accounts.

import '../tracking/device-form';

import { AccountModel } from 'flyxc/common/src/models';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('account-editor')
export class AccountEditor extends LitElement {
  @property()
  public id = '';

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
    fetch(`/admin/_account/${this.id}`)
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
    let body: TemplateResult | null = null;

    if (this.isLoading) {
      body = html`
        <div class="notification my-4 content">
          <progress class="progress is-small is-primary" max="100">60%</progress>
        </div>
      `;
    } else if (this.account) {
      body = html`<device-form
        .token=${this.token}
        .account=${this.account}
        action=${`/admin/_account/${this.id}`}
        @save=${this.handleBack}
        @cancel=${this.handleBack}
      ></device-form>`;
    }

    return html`
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <section class="hero is-dark">
        <div class="hero-body">
          <div class="container">
            <h1 class="title">Account Editor</h1>
            ${this.account?.name ? html`<h2 class="subtitle">Account "${this.account.name}"</h2>` : null}
          </div>
        </div>
      </section>

      <div class="container">${body}</div>
    `;
  }

  private handleBack(): void {
    document.location.assign('/admin.html');
  }
}
