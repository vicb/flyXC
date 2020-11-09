import { css, CSSResult, customElement, html, LitElement, property, PropertyValues, TemplateResult } from 'lit-element';

@customElement('loader-element')
export class LoaderElement extends LitElement {
  @property()
  show = true;

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
        <svg id="bat" preserveAspectRatio="xMidYMax meet" viewBox="0 -14 512 295">
          <path
            fill="#fa8c00"
            d="M390 7.43c-20.1 7.3-31.9 16.2-35.5 19.2-12.1 63.5-43.8 85.5-68.5 92.5a5.4 5.4 0 01-6.8-4.1c-.2-.7-.2-.9.2-25.3l-12.3 8.4c-1 .7-2.3 1-3.5 1h-15.4c-1.2 0-2.5-.3-3.5-1l-12.3-8.4c.4 24.4.3 24.6.2 25.3a5.4 5.4 0 01-6.8 4.1c-24.6-7.1-56.3-29-68.4-92.5-3.6-3-15.4-11.9-35.6-19.2-21-7.5-55.2-14.6-102.7-8.2a118.3 118.3 0 0141 93.2c11.9.14 23.68 2.37 34.8 6.6 18 7 40.5 22.6 50.3 57.3 10.9-8.7 27.8-12.6 53.8-12.6a60.8 60.8 0 0148 22.5 71.9 71.9 0 018.8 13.5c2.3-4.5 5.3-9.2 8.9-13.5a60.8 60.8 0 0148-22.5c26 0 43 4 54 12.7a82.2 82.2 0 0150.3-57.3 101 101 0 0134.8-6.6 118.3 118.3 0 0141-93.2c-47.5-6.4-81.8.7-102.7 8.2z"
          />
          <path
            d="M507.5-9.46c-57-10.2-97.7-1.8-121.8 7a120.2 120.2 0 00-40 22.4c-.8.7-1.4 1.8-1.6 2.9-9.7 53.3-33.4 75-54 83.4l.5-26.8a5.4 5.4 0 00-8.5-4.6l-19.6 13.3h-13l-19.6-13.3a5.4 5.4 0 00-8.5 4.6l.5 26.8c-20.6-8.5-44.3-30.1-54-83.4a5.4 5.4 0 00-1.6-3c-.6-.5-13.4-12.7-40-22.3-24.1-8.8-64.9-17.2-121.8-7a5.4 5.4 0 00-1.8 10 94.98 94.98 0 0124.9 23.1c16 20.8 23.2 45.7 21.6 74a5.4 5.4 0 005.9 5.8c.2 0 17.2-1.5 36 5.8 24.8 9.6 40.2 29.5 45.8 59.2a5.4 5.4 0 005.4 4.4 6 6 0 004.4-2.3c5.6-7.9 16.1-15.9 52.4-15.9 35.9 0 48.7 30.2 51.4 42 .1.9 1.4 5.8 5.5 5.8 4 0 5.3-5.2 5.4-5.7 2.2-10.6 15.5-42 51.3-42 36.4 0 47 8 52.4 15.8 0 0 1.5 1.9 3.6 2.2 3 .4 5.8-1.4 6.4-4.3 5.6-29.5 20.9-49.4 45.5-59.1 18.7-7.4 36.1-6 36.3-6a5.4 5.4 0 006-5.6 107.6 107.6 0 0121.5-74.1 95.02 95.02 0 0124.8-23 5.4 5.4 0 00-1.7-10.1zm-31.4 26c-11.6 15-25 40.2-24.3 75.9-7.5 0-20.7 1.1-34.8 6.6-18 7-40.6 22.6-50.3 57.4-11-8.8-27.9-12.7-54-12.7a60.8 60.8 0 00-48 22.5 72 72 0 00-8.8 13.5 71.9 71.9 0 00-8.8-13.5 60.8 60.8 0 00-48-22.5c-26 0-42.9 3.9-53.8 12.6A82.2 82.2 0 0095 99.14a100.99 100.99 0 00-34.8-6.6 118.3 118.3 0 00-41-93.2c47.5-6.4 81.8.7 102.7 8.2 20.2 7.3 32 16.2 35.6 19.2 12.1 63.4 43.8 85.4 68.5 92.4a5.4 5.4 0 006.8-4.1c.1-.7.2-.9-.2-25.3l12.3 8.4c1 .7 2.3 1 3.5 1h15.4c1.2 0 2.5-.3 3.5-1l12.3-8.4c-.4 24.4-.4 24.6-.2 25.3a5.4 5.4 0 006.8 4.1c24.6-7.1 56.3-29 68.4-92.5 3.6-3 15.4-11.9 35.6-19.2 21-7.5 55.2-14.6 102.7-8.2a115.07 115.07 0 00-16.7 17.4z"
          />
          <circle cx="256" cy="295" r="15">
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
          <g filter="url(#a)" transform="matrix(.34471 0 0 .41558 130.07 203.62)">
            <path
              fill="#fff"
              d="M170.6 92.13c-5-5-12-7-21-7h-57l-7 18h57c2 0 3 0 5 2l1 4-13 29c0 2-2 3-4 5l-6 1h-59c-2 0-3 0-5-2l-1-4 12-27h-25l-12 27c-2 7-1 12 3 17 5 5 12 7 21 7h58c9 0 18-2 27-7 8-5 13-10 16-17l13-29c2-7 1-12-3-17m420 52c-1 0-3 0-4-2-2-1-2-2-1-4l2-6h71l7-17h-70l2-6 4-5 7-1h65l8-18h-66c-9 0-18 2-26 7-9 5-14 10-17 17l-12 29c-3 7-2 12 2 17 5 5 12 7 21 7h67l7-18h-67zm-301-30l12-6c4-2 6-5 7-8 2-4 1-8-2-11-2-3-7-4-12-4h-103l-8 18h87l-89 31-11 5-6 8c-2 4-1 8 1 11 3 3 8 4 13 4h105l8-18h-90l88-30zm147-22c-5-5-11-7-20-7h-59c-9 0-18 2-26 7-9 5-14 10-17 17l-12 29c-3 7-2 12 3 17 4 5 11 7 20 7h58c10 0 18-2 27-7 8-4 14-10 16-17l13-29c3-7 2-12-3-17zm-22 17l-13 29c0 2-2 3-4 5l-6 1h-59c-2 0-3 0-4-2-2-1-2-2-1-4l12-29c1-2 2-3 5-4 2-2 4-2 6-2h58c2 0 4 0 5 2 1 1 2 2 1 4zm147-17c-5-5-12-7-21-7h-50c-9 0-18 2-26 7-9 5-14 10-17 17l-22 53h25l22-53 4-5 7-1h50c2 0 4 0 5 2l1 4-23 53h25l23-53c2-7 1-12-3-17"
              class="st4"
            />
            <path
              fill="#dd1407"
              d="M72.6 111.13l1-2c0-2 2-3 5-4 2-2 4-2 5-2h2l7-18h-1c-9 0-18 2-26 7-9 5-15 10-17 17l-1 2h25z"
            />
          </g>
        </svg>
      </div>
    `;
  }
}
