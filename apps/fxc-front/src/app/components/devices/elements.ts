import { AccountFormModel, AccountModel, trackerDisplayNames, TrackerIds, trackerPropNames } from '@flyxc/common';
import * as lit from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import { Binder } from '../../../vaadin/form/Binder';
import { CheckedFieldStrategy, field, VaadinFieldStrategy } from '../../../vaadin/form/Field';

// Card for a single tracker.
@customElement('device-card')
export class TrackerPanel extends lit.LitElement {
  @property()
  label = '';

  @property({ attribute: false })
  hint?: lit.TemplateResult;

  @property()
  inputMode = 'text';

  @property({ attribute: false })
  binder!: Binder<AccountModel, AccountFormModel>;

  @property({ attribute: false })
  tracker!: TrackerIds;

  protected render(): lit.TemplateResult {
    const trackerName = trackerDisplayNames[this.tracker];
    const property = trackerPropNames[this.tracker];
    const model = (this.binder.model as any)[property];

    return lit.html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css"
      />
      <ion-card class="ion-padding-bottom">
        <ion-card-header color="secondary">
          <ion-card-title><i class="las la-calculator"></i> ${trackerName}</ion-card-title>
        </ion-card-header>
        <flow-ion-check label="Enabled" labelOff="Disabled" ...=${field(model.enabled)}></flow-ion-check>
        ${when(
          model.enabled.valueOf(),
          () =>
            lit.html`${this.hint} <flow-ion-input label=${this.label} ...=${field(model.account)}></flow-ion-input>`,
        )}
      </ion-card>
    `;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

// Text field with Vaadin Flow support.
@customElement('flow-ion-input')
export class FlowIonInput extends lit.LitElement {
  // Flow form integration.
  static strategy = VaadinFieldStrategy;

  @property()
  label?: string;

  @property()
  inputMode = 'text';

  @property({ attribute: false })
  invalid = false;

  @property({ attribute: false })
  errorMessage = '';

  @property({ attribute: false })
  value = '';

  protected render(): lit.TemplateResult {
    return lit.html`<ion-item lines="full">
      <ion-label position="floating">${this.label}</ion-label>
      <ion-input
        @input=${this.handleInput}
        type="text"
        value=${this.value}
        inputmode=${this.inputMode}
        .color=${this.errorMessage ? 'danger' : undefined}
      ></ion-input>
      ${when(
        this.errorMessage,
        () =>
          lit.html`<ion-note color="danger"
            ><i class="las la-exclamation-circle"></i> ${unsafeHTML(this.errorMessage)}</ion-note
          >`,
      )}
    </ion-item>`;
  }

  private handleInput(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}

// Checkbox with Vaadin Flow support.
@customElement('flow-ion-check')
export class FlowIonCheck extends lit.LitElement {
  // Flow form integration.
  static strategy = CheckedFieldStrategy;

  @property()
  label?: string;

  @property()
  labelOff?: string;

  @property({ attribute: false })
  checked = false;

  protected render(): lit.TemplateResult {
    return lit.html`
      <ion-item button lines="full" @click=${this.handleClick}>
        <ion-label>${this.checked ? this.label : this.labelOff ?? this.label}</ion-label>
        <ion-toggle @change=${this.handleClick} slot="end" .checked=${this.checked}></ion-toggle>
      </ion-item>
    `;
  }

  private handleClick() {
    this.checked = !this.checked;
    this.dispatchEvent(new Event('change'));
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
