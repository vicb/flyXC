import './text-field';

import { trackerDisplayNames, TrackerIds, trackerPropNames } from 'flyxc/common/src/live-track';
import { AccountFormModel, AccountModel } from 'flyxc/common/src/models';
import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, query, queryAll, state } from 'lit/decorators.js';

import { Binder } from '@vaadin/form/Binder';
import { field } from '@vaadin/form/Field';

@customElement('device-form')
export class DeviceForm extends LitElement {
  @property({ attribute: false })
  account!: AccountModel;

  @property({ attribute: false })
  token = '';

  @property()
  public action = '';

  @state()
  private submitting = false;

  @state()
  private error = '';

  @queryAll('tracker-panel')
  private trackerPanels: any;

  @query('#dlg-error')
  private dialogError: any;

  // Make sure to refresh the components when the form data are updated.
  private binder = new Binder(this, AccountFormModel, {
    onChange: () => {
      this.requestUpdate();
      if (this.trackerPanels) {
        for (let i = 0; i < this.trackerPanels.length; i++) {
          this.trackerPanels[i].requestUpdate();
        }
      }
    },
  });

  static get styles(): CSSResult {
    return css`
      .panel-block {
        display: block;
      }
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.binder.read(this.account);
  }

  protected render(): TemplateResult {
    const model = this.binder.model;

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />

      <div class="panel is-warning" style="margin-top: 1em;">
        <div class="panel-heading">
          <p>General</p>
        </div>
        <div class="panel-block">
          <text-field label="Your name" ...=${field(model.name)}></text-field>

          <div class="field">
            <div class="control">
              <label class="checkbox">
                <input id="enabled" type="checkbox" ...=${field(model.enabled)} />
                Track me: uncheck this box if you do not want to appear on the map.
              </label>
            </div>
          </div>

          <div class="field">
            <div class="control">
              <label class="checkbox">
                <input type="checkbox" ...=${field(model.share)} />
                Share my positions with FlyXC live tracking providers (FlyMe).
              </label>
            </div>
          </div>
        </div>
      </div>

      ${model.enabled.valueOf()
        ? html`<p class="my-4">FlyXC aggregates the positions from all the tracking providers enabled below.</p>
            <tracker-panel .tracker=${TrackerIds.Inreach} .binder=${this.binder} label="MapShare URL" inputmode="url">
              <p class="help" slot="hint">
                Visit
                <a href="https://explore.garmin.com/Social" target="_blank" class="has-text-link">
                  your InReach social profile
                </a>
                and copy your MapShare address in the field above (it should look like
                <span class="has-text-info">https://share.garmin.com/username</span> or
                <span class="has-text-info">https://share.garmin.com/Feed/Share/username</span>).
              </p>
            </tracker-panel>
            <tracker-panel .tracker=${TrackerIds.Spot} .binder=${this.binder} label="Feed Id">
              <p class="help" slot="hint">
                Create an XML feed by following the instructions on this
                <a
                  href="https://www.findmespot.com/en-us/support/spot-trace/get-help/general/spot-api-support"
                  target="_blank"
                  class="has-text-link"
                >
                  page.
                </a>
                and paste the feed id into the field above (it should look like
                <span class="has-text-info">0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq</span>).
              </p>
            </tracker-panel>
            <tracker-panel .tracker=${TrackerIds.Skylines} .binder=${this.binder} label="Pilot Id" inputmode="numeric">
              <p class="help" slot="hint">
                Your pilot's id is at the end of your SkyLines profile url:
                <span class="has-text-info">https://skylines.aero/users/id</span> (it should be a numerical value like
                <span class="has-text-info">1234</span>).
              </p>
            </tracker-panel>
            <tracker-panel .tracker=${TrackerIds.Flyme} .binder=${this.binder} label="Username" inputmode="email">
              <p class="help" slot="hint">
                Enter your FlyMe (XCGlobe) username in the field above. It commonly is your email.
              </p>
            </tracker-panel>
            <tracker-panel .tracker=${TrackerIds.Flymaster} .binder=${this.binder} label="Device Id">
              <p class="help" slot="hint">
                Login to
                <a href="https://lt.flymaster.net" target="_blank" class="has-text-link">lt.flymaster.net</a> and click
                on "My account", followed by "My Instruments". Copy the numerical id of the instrument in the field
                above.
              </p>
            </tracker-panel>`
        : null}

      <div class="field is-grouped is-grouped-right">
        <p class="control">
          <button class="button is-light" @click=${this.handleCancel}>Cancel</button>
        </p>
        <p class="control">
          <button
            class=${`button is-link ${this.submitting ? 'is-loading' : ''}`}
            ?disabled=${this.binder.invalid}
            @click=${this.handleSubmit}
          >
            Save
          </button>
        </p>
      </div>

      <div id="dlg-error" class="modal" @click=${this.handleCloseError}>
        <div class="modal-background"></div>
        <div class="modal-content">
          <div class="notification my-4">
            <p class="my-2">An error has occured:</p>
            <p class="my-2">${this.error}</p>
          </div>
        </div>
        <button class="modal-close is-large is-error" aria-label="close"></button>
      </div>`;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (this.binder.invalid) {
      return;
    }

    this.submitting = true;
    this.error = '';

    try {
      await this.binder.submitTo(async (values) => {
        let response: any;

        try {
          response = await fetch(this.action, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'xsrf-token': this.token,
            },
            body: JSON.stringify(values),
          });
        } catch (e) {
          this.error = 'Unexpected error, please try again later!';
          return;
        }

        this.submitting = false;

        if (!response.ok) {
          this.error = 'Unexpected error, please try again later!';
          return;
        }

        const status = await response.json();

        if (status.error) {
          this.error = status.error;
          throw { validationErrorData: status.validationErrorData };
        }
      });
    } catch (e) {}
    if (this.error.length) {
      this.dialogError.classList.add('is-active');
    } else {
      this.dispatchEvent(new CustomEvent('save'));
    }
  }

  private handleCloseError(): void {
    this.dialogError.classList.remove('is-active');
  }

  private handleCancel(): void {
    this.dispatchEvent(new CustomEvent('cancel'));
  }
}

// Panel for a single tracker.
@customElement('tracker-panel')
export class TrackerPanel extends LitElement {
  @property()
  label = '';

  @property()
  inputMode = 'text';

  @property({ attribute: false })
  binder!: Binder<AccountModel, AccountFormModel>;

  @property({ attribute: false })
  tracker!: TrackerIds;

  static get styles(): CSSResult {
    return css`
      .panel-block {
        display: block;
        margin-bottom: 1rem;
      }
    `;
  }

  protected render(): TemplateResult {
    const trackerName = trackerDisplayNames[this.tracker];
    const property = trackerPropNames[this.tracker];
    const model = (this.binder.model as any)[property];

    return html`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9/css/bulma.min.css" />
      <div class="panel is-warning">
        <div class="panel-heading">
          <label class="checkbox">
            <input id="enabled" type="checkbox" ...=${field(model.enabled)} />
            ${trackerName}
          </label>
        </div>
        ${model.enabled.valueOf()
          ? html`<div class="panel-block">
              <text-field label=${this.label} inputmode=${this.inputMode} ...=${field(model.account)}></text-field>
              <slot name="hint"></slot>
            </div>`
          : html`<div class="panel-block has-text-centered">
              <p class="has-text-grey"><em>${trackerName} is not enabled</em></p>
            </div>`}
      </div>`;
  }
}
