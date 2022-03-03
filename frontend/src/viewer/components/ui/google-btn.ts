import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

@customElement('google-btn')
export class GoogleButton extends LitElement {
  @property()
  callback?: string;

  private devicePixelRatio = devicePixelRatio;

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
      }
      input[type='image']:hover {
        box-shadow: 0 0 3px #4285f4;
      }
      input[type='image']:active {
        box-shadow: 0 0 3px #073888;
      }
      input[type='image']:focus {
        outline: none;
      }
    `;
  }

  protected render(): TemplateResult {
    const action = '/oauth/google';
    return html`<form action=${action}>
      ${when(this.callback, () => html`<input type="hidden" name="callback" value=${this.callback} />`)}
      <input
        type="image"
        src=${`/img/btn_google_signin_dark_normal_web${this.devicePixelRatio > 1 ? '@2x' : ''}.png`}
        alt="Sign-in with Google"
        width="191"
        height="46"
      />
    </form>`;
  }
}
