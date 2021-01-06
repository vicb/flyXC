import { css, CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';

@customElement('google-btn')
export class GoogleButton extends LitElement {
  @property()
  override?: string;

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
    const action = '/oauth/google' + (this.override ? `/${this.override}` : '');
    return html`<form action=${action}>
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
