import * as common from '@flyxc/common';
import type { Binder } from '@vaadin/dom';
import { CheckedFieldStrategy, field, VaadinFieldStrategy } from '@vaadin/dom';
import * as lit from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

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
  binder!: Binder<common.AccountModel, common.AccountFormModel>;

  @property({ attribute: false })
  tracker!: common.TrackerNames;

  protected render(): lit.TemplateResult {
    const trackerName = common.trackerDisplayNames[this.tracker];
    const model = this.binder.model[this.tracker];

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
  errorMessage?: string;

  @property({ attribute: false })
  value = '';

  @query('ion-input', true)
  input?: HTMLIonInputElement;

  protected shouldUpdate(changedProps: lit.PropertyValueMap<any>): boolean {
    if (changedProps.has('invalid')) {
      const cl = this.input?.classList;
      if (cl) {
        cl.toggle('ion-invalid', this.invalid);
        cl.toggle('ion-valid', !this.invalid);
      }
    }

    return super.shouldUpdate(changedProps);
  }

  protected render(): lit.TemplateResult {
    return lit.html`<ion-item lines="full">
      <ion-input
        label=${this.label}
        label-placement="floating"
        @ionInput=${this.handleInput}
        type="text"
        value=${this.value}
        inputmode=${this.inputMode}
        .errorText=${this.errorMessage}
        .invalid=${this.invalid}
        @ionBlur=${this.markedTouched}
      ></ion-input>
    </ion-item>`;
  }

  protected handleInput(e: CustomEvent) {
    this.value = e.detail.value;
  }

  protected markedTouched() {
    this.input?.classList.add('ion-touched');
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
    return lit.html`<ion-item button lines="full">
      <ion-toggle @ionChange=${this.handleClick} .checked=${this.checked}
        >${this.checked ? this.label : this.labelOff ?? this.label}</ion-toggle
      ></ion-item
    >`;
  }

  private handleClick() {
    this.checked = !this.checked;
    this.dispatchEvent(new Event('change'));
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
