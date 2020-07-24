import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  PropertyValues,
  TemplateResult,
} from 'lit-element';
import { connect } from 'pwa-helpers';

import { RootState, store } from '../store';

@customElement('loader-element')
export class LoaderElement extends connect(store)(LitElement) {
  @internalProperty()
  hidden = true;

  stateChanged(state: RootState): void {
    if (state.map) {
      this.hidden = !state.map.loading;
    }
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
      div {
        background-color: #111;
        opacity: 0.99;
        width: 100%;
        height: 100%;
      }
      #bat {
        position: absolute;
        top: 50%;
        left: 50%;
        margin: -512px 0 0 -512px;
      }
      #loader {
        position: absolute;
        top: 50%;
        left: 50%;
        margin: 65px 0 0 -60px;
      }
    `;
  }

  protected update(changedProperties: PropertyValues): void {
    super.update(changedProperties);
    const shadowRoot = this.shadowRoot as ShadowRoot;
    (shadowRoot.host as HTMLElement).style.display = this.hidden ? 'none' : 'block';
  }

  render(): TemplateResult {
    return html`
      <div>
        <svg id="bat" viewBox="0 0 512 512" width="1024" height="1024">
          <path
            fill="#fa8c00"
            d="M390 169.3c-20.1 7.3-31.9 16.2-35.5 19.2C342.4 252 310.7 274 286 281a5.4 5.4 0 0 1-6.8-4.1c-.2-.7-.2-.9.2-25.3l-12.3 8.4c-1 .7-2.3 1-3.5 1h-15.4c-1.2 0-2.5-.3-3.5-1l-12.3-8.4c.4 24.4.3 24.6.2 25.3a5.4 5.4 0 0 1-6.8 4.1c-24.6-7.1-56.3-29-68.4-92.5-3.6-3-15.4-11.9-35.6-19.2-21-7.5-55.2-14.6-102.7-8.2a118.3 118.3 0 0 1 41 93.2 101 101 0 0 1 34.8 6.6c18 7 40.5 22.6 50.3 57.3 10.9-8.7 27.8-12.6 53.8-12.6a60.8 60.8 0 0 1 48 22.5 72 72 0 0 1 8.8 13.5c2.3-4.5 5.3-9.2 8.9-13.5a60.8 60.8 0 0 1 48-22.5c26 0 43 4 54 12.7A82.2 82.2 0 0 1 417 261a101 101 0 0 1 34.8-6.6 118.3 118.3 0 0 1 41-93.2c-47.5-6.4-81.8.7-102.7 8.2z"
          />
          <path
            d="M507.5 152.4c-57-10.2-97.7-1.8-121.8 7a120.2 120.2 0 0 0-40 22.4c-.8.7-1.4 1.8-1.6 2.9-9.7 53.3-33.4 75-54 83.4l.5-26.8a5.4 5.4 0 0 0-8.5-4.6L262.5 250h-13l-19.6-13.3a5.4 5.4 0 0 0-8.5 4.6l.5 26.8c-20.6-8.5-44.3-30.1-54-83.4a5.4 5.4 0 0 0-1.6-3c-.6-.5-13.4-12.7-40-22.3-24.1-8.8-64.9-17.2-121.8-7a5.4 5.4 0 0 0-1.8 10 95 95 0 0 1 24.9 23.1c16 20.8 23.2 45.7 21.6 74a5.4 5.4 0 0 0 5.9 5.8c.2 0 17.2-1.5 36 5.8 24.8 9.6 40.2 29.5 45.8 59.2a5.4 5.4 0 0 0 5.4 4.4 6 6 0 0 0 4.4-2.3c5.6-7.9 16.1-15.9 52.4-15.9 35.9 0 48.7 30.2 51.4 42 .1.9 1.4 5.8 5.5 5.8 4 0 5.3-5.2 5.4-5.7 2.2-10.6 15.5-42 51.3-42 36.4 0 47 8 52.4 15.8 0 0 1.5 1.9 3.6 2.2 3 .4 5.8-1.4 6.4-4.3 5.6-29.5 20.9-49.4 45.5-59.1 18.7-7.4 36.1-6 36.3-6a5.4 5.4 0 0 0 6-5.6 107.6 107.6 0 0 1 21.5-74.1 95 95 0 0 1 24.8-23 5.4 5.4 0 0 0-1.7-10.1zm-31.4 26c-11.6 15-25 40.2-24.3 75.9-7.5 0-20.7 1.1-34.8 6.6-18 7-40.6 22.6-50.3 57.4-11-8.8-27.9-12.7-54-12.7a60.8 60.8 0 0 0-48 22.5 72 72 0 0 0-8.8 13.5 72 72 0 0 0-8.8-13.5 60.8 60.8 0 0 0-48-22.5c-26 0-42.9 3.9-53.8 12.6A82.2 82.2 0 0 0 95 261a101 101 0 0 0-34.8-6.6 118.3 118.3 0 0 0-41-93.2c47.5-6.4 81.8.7 102.7 8.2 20.2 7.3 32 16.2 35.6 19.2C169.6 252 201.3 274 226 281a5.4 5.4 0 0 0 6.8-4.1c.1-.7.2-.9-.2-25.3l12.3 8.4c1 .7 2.3 1 3.5 1h15.4c1.2 0 2.5-.3 3.5-1l12.3-8.4c-.4 24.4-.4 24.6-.2 25.3a5.4 5.4 0 0 0 6.8 4.1c24.6-7.1 56.3-29 68.4-92.5 3.6-3 15.4-11.9 35.6-19.2 21-7.5 55.2-14.6 102.7-8.2a115 115 0 0 0-16.7 17.4z"
          />
        </svg>
        <svg width="120" height="30" fill="#000" id="loader">
          <circle cx="15" cy="15" r="15">
            <animate
              attributeName="r"
              from="15"
              to="15"
              begin="0s"
              dur="0.8s"
              values="15;9;15"
              calcMode="linear"
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              from="1"
              to="1"
              begin="0s"
              dur="0.8s"
              values="1;.5;1"
              calcMode="linear"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="60" cy="15" r="9" fill-opacity=".3">
            <animate
              attributeName="r"
              from="9"
              to="9"
              begin="0s"
              dur="0.8s"
              values="9;15;9"
              calcMode="linear"
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              from=".5"
              to=".5"
              begin="0s"
              dur="0.8s"
              values=".5;1;.5"
              calcMode="linear"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="105" cy="15" r="15">
            <animate
              attributeName="r"
              from="15"
              to="15"
              begin="0s"
              dur="0.8s"
              values="15;9;15"
              calcMode="linear"
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              from="1"
              to="1"
              begin="0s"
              dur="0.8s"
              values="1;.5;1"
              calcMode="linear"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
    `;
  }
}
