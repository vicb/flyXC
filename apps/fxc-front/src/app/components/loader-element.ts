import type { CSSResult, PropertyValues, TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';
import type { RootState } from '../redux/store';
import { store } from '../redux/store';

@customElement('loader-element')
export class LoaderElement extends connect(store)(LitElement) {
  @property()
  show = true;

  @state()
  showSponsor = true;

  stateChanged(state: RootState): void {
    this.showSponsor = !state.browser.isFromFfvl;
  }

  static get styles(): CSSResult {
    return css`
      :host {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      #bkg {
        background-color: #222;
        opacity: 0.99;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #bat {
        width: 1024px;
        max-width: 90%;
      }
    `;
  }

  protected update(changedProperties: PropertyValues): void {
    super.update(changedProperties);
    const shadowRoot = this.shadowRoot as ShadowRoot;
    (shadowRoot.host as HTMLElement).style.display = this.show ? 'block' : 'none';
  }

  protected render(): TemplateResult {
    return html`
      <div id="bkg">
        <svg id="bat" preserveAspectRatio="xMidYMax meet" viewBox="0 -14 512 395">
          <path
            fill="#fa8c00"
            d="M390 7.43c-20.1 7.3-31.9 16.2-35.5 19.2-12.1 63.5-43.8 85.5-68.5 92.5a5.4 5.4 0 01-6.8-4.1c-.2-.7-.2-.9.2-25.3l-12.3 8.4c-1 .7-2.3 1-3.5 1h-15.4c-1.2 0-2.5-.3-3.5-1l-12.3-8.4c.4 24.4.3 24.6.2 25.3a5.4 5.4 0 01-6.8 4.1c-24.6-7.1-56.3-29-68.4-92.5-3.6-3-15.4-11.9-35.6-19.2-21-7.5-55.2-14.6-102.7-8.2a118.3 118.3 0 0141 93.2c11.9.14 23.68 2.37 34.8 6.6 18 7 40.5 22.6 50.3 57.3 10.9-8.7 27.8-12.6 53.8-12.6a60.8 60.8 0 0148 22.5 71.9 71.9 0 018.8 13.5c2.3-4.5 5.3-9.2 8.9-13.5a60.8 60.8 0 0148-22.5c26 0 43 4 54 12.7a82.2 82.2 0 0150.3-57.3 101 101 0 0134.8-6.6 118.3 118.3 0 0141-93.2c-47.5-6.4-81.8.7-102.7 8.2z"
          />
          <path
            d="M507.5-9.46c-57-10.2-97.7-1.8-121.8 7a120.2 120.2 0 00-40 22.4c-.8.7-1.4 1.8-1.6 2.9-9.7 53.3-33.4 75-54 83.4l.5-26.8a5.4 5.4 0 00-8.5-4.6l-19.6 13.3h-13l-19.6-13.3a5.4 5.4 0 00-8.5 4.6l.5 26.8c-20.6-8.5-44.3-30.1-54-83.4a5.4 5.4 0 00-1.6-3c-.6-.5-13.4-12.7-40-22.3-24.1-8.8-64.9-17.2-121.8-7a5.4 5.4 0 00-1.8 10 94.98 94.98 0 0124.9 23.1c16 20.8 23.2 45.7 21.6 74a5.4 5.4 0 005.9 5.8c.2 0 17.2-1.5 36 5.8 24.8 9.6 40.2 29.5 45.8 59.2a5.4 5.4 0 005.4 4.4 6 6 0 004.4-2.3c5.6-7.9 16.1-15.9 52.4-15.9 35.9 0 48.7 30.2 51.4 42 .1.9 1.4 5.8 5.5 5.8 4 0 5.3-5.2 5.4-5.7 2.2-10.6 15.5-42 51.3-42 36.4 0 47 8 52.4 15.8 0 0 1.5 1.9 3.6 2.2 3 .4 5.8-1.4 6.4-4.3 5.6-29.5 20.9-49.4 45.5-59.1 18.7-7.4 36.1-6 36.3-6a5.4 5.4 0 006-5.6 107.6 107.6 0 0121.5-74.1 95.02 95.02 0 0124.8-23 5.4 5.4 0 00-1.7-10.1zm-31.4 26c-11.6 15-25 40.2-24.3 75.9-7.5 0-20.7 1.1-34.8 6.6-18 7-40.6 22.6-50.3 57.4-11-8.8-27.9-12.7-54-12.7a60.8 60.8 0 00-48 22.5 72 72 0 00-8.8 13.5 71.9 71.9 0 00-8.8-13.5 60.8 60.8 0 00-48-22.5c-26 0-42.9 3.9-53.8 12.6A82.2 82.2 0 0095 99.14a100.99 100.99 0 00-34.8-6.6 118.3 118.3 0 00-41-93.2c47.5-6.4 81.8.7 102.7 8.2 20.2 7.3 32 16.2 35.6 19.2 12.1 63.4 43.8 85.4 68.5 92.4a5.4 5.4 0 006.8-4.1c.1-.7.2-.9-.2-25.3l12.3 8.4c1 .7 2.3 1 3.5 1h15.4c1.2 0 2.5-.3 3.5-1l12.3-8.4c-.4 24.4-.4 24.6-.2 25.3a5.4 5.4 0 006.8 4.1c24.6-7.1 56.3-29 68.4-92.5 3.6-3 15.4-11.9 35.6-19.2 21-7.5 55.2-14.6 102.7-8.2a115.07 115.07 0 00-16.7 17.4z"
          />
          <circle cx="256" cy="135" r="15">
            <animate attributeName="r" dur="0.8s" values="15;9;15" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" dur="0.8s" values="1;.5;1" repeatCount="indefinite" />
          </circle>
          <filter id="a" width="140%" height="140%" x="-20%" y="-20%">
            <feGaussianBlur in="SourceAlpha" result="blur" stdDeviation="4" />
            <feOffset dx="4" dy="4" in="blur" result="offsetBlur" />
            <feSpecularLighting in="blur" lighting-color="#fff" result="specOut" specularExponent="10" surfaceScale="5">
              <fePointLight x="-5000" y="-10000" z="-20000" />
            </feSpecularLighting>
            <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
            <feComposite in="SourceGraphic" in2="specOut" k2="1" k3="1" operator="arithmetic" result="litPaint" />
            <feMerge>
              <feMergeNode in="offsetBlur" />
              <feMergeNode in="litPaint" />
            </feMerge>
          </filter>
          <g visibility=${this.showSponsor ? 'visible' : 'hidden'} transform="scale(2 2) translate(0 100)">
            <path
              d="M198 35.1c-.1 1.1-1 1.9-2.3 1.9h-2.2l1.9-5.9h2.1c1 0 1.4.5 1.4 1.2-.1.7-.6 1.3-1.3 1.6.1.2.4.5.4 1.2zm-.8.1c.1-.5-.2-.9-.8-.9H195l-.7 2.1h1.4c.8 0 1.4-.6 1.5-1.2zm-2-1.6h1.3c.7 0 1.3-.5 1.3-1.2.1-.5-.2-.8-.7-.8h-1.3l-.6 2zm8.3 2.7-.2.7h-3.8l1.9-5.9h3.7l-.2.7h-3l-.6 1.9h2.6l-.2.7h-2.6l-.6 2h3zm8.1-5.2-3.1 3.1-.9 2.8h-.8l.9-2.8-1.2-3.1h.9l.8 2.3h.1l2.3-2.3h1zm.6 3.6c.2-1.9 2-3.7 3.9-3.7 1.5 0 2.4 1 2.2 2.4-.2 1.9-2 3.6-3.9 3.6-1.5.1-2.3-.9-2.2-2.3zm5.3-1.2c.1-1.1-.5-1.8-1.5-1.8-1.4 0-2.8 1.4-3 2.9-.1 1.1.5 1.8 1.5 1.8 1.5 0 2.9-1.4 3-2.9zm8.5-2.4-1.9 5.9h-.7l-1.8-4.6h-.1l-1.4 4.6h-.8l1.9-5.9h.8l1.8 4.6h.1l1.4-4.6h.7zm6.2 2.3c-.2 2-1.7 3.6-3.9 3.6h-1.9l1.9-5.9h1.8c1.6 0 2.3.8 2.1 2.3zm-.8 0c.2-1.5-.9-1.6-1.5-1.6h-1l-1.4 4.5h1c1.6 0 2.8-1.3 2.9-2.9zM198 40.6h-1.7l-1.6 5.2h-.8l1.6-5.2h-1.7l.2-.7h4.2l-.2.7zm6.5-.7-1.9 5.9h-.8l.8-2.6h-2.9l-.8 2.6h-.8l1.9-5.9h.8l-.8 2.6h2.9l.8-2.6h.8zm4.5 5.3-.2.7H205l1.9-5.9h3.7l-.2.7h-3l-.6 1.9h2.6l-.2.7h-2.6l-.6 2h3zm11.1-2.4-1 3.1h-.6l.1-.7h-.1c-.3.3-1 .8-2 .8-1.4 0-2.2-.9-2-2.3.2-2 2-3.8 4-3.8 1.3 0 2 .8 1.9 1.8h-.8c0-.6-.5-1.1-1.3-1.1-1.5 0-2.9 1.4-3 3-.1 1 .4 1.7 1.4 1.7.9 0 1.9-.5 2.2-1.4l.1-.4h-1.7l.1-.6h2.7zm5.3 2.3-.2.7h-3.8l1.9-5.9h.8l-1.6 5.2h2.9zm2.5.7h-.8l1.9-5.9h.8l-1.9 5.9zm8.1-3.6c-.2 2-1.7 3.6-3.9 3.6h-1.9l1.9-5.9h1.8c1.5 0 2.2.8 2.1 2.3zm-.8.1c.2-1.5-.9-1.6-1.5-1.6h-1l-1.4 4.5h1c1.5-.1 2.7-1.4 2.9-2.9zm5.9 2.9-.2.7H237l1.9-5.9h3.7l-.2.7h-3l-.6 1.9h2.6l-.2.7h-2.6l-.6 2h3.1zM69.3 46h8.4l4.6-27.6h-8.4zm38.6-27.6L97.5 38.5l-4.2-20.1h-8.6L90.8 46h10.9l15.2-27.6zm6.9 27.6h8.4l4.6-27.6h-8.4zm44.9-27.6h-8.4l-.8 4.8-1.9 11.5c-.1.9-.4 1.7-.7 2.4-.3.7-.7 1.3-1.2 1.8s-1.1.8-1.7 1.1c-.7.2-1.5.4-2.4.4-1 0-1.8-.1-2.4-.4-.6-.2-1.1-.6-1.4-1.1-.3-.5-.6-1.1-.6-1.8-.1-.7 0-1.5.1-2.4l1.9-11.5.8-4.8h-8.4l-.8 4.8-1.9 11.5c-.3 2-.3 3.7.1 5.2s1.1 2.8 2.1 3.8 2.4 1.8 4.1 2.3c1.7.5 3.7.8 6 .8s4.3-.2 6-.7a12 12 0 0 0 4.4-2.1c1.2-1 2.2-2.2 2.9-3.7.7-1.5 1.3-3.4 1.6-5.5l1.9-11.5.7-4.9zm33.5 0h-10.5L171 29.2l1.9-10.8h-8.4L159.8 46h8.4l1.8-10.6 8 10.6h10.2L178 32.3zm-142.8 0h-1.3C34.3 19.1 20.6 31.2 18 46h8.4c.1-.7.3-1.3.5-1.9 2.7-9.1 11.3-16.3 20.7-17.2.6-.1 1.2-.1 1.9-.1h8.9L55 46h8.4L68 18.4H50.4z"
              style="fill:#fff"
            />
          </g>
        </svg>
      </div>
    `;
  }
}
