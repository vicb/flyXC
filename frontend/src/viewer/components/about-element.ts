import { CSSResult, LitElement, TemplateResult, css, customElement, html } from 'lit-element';

@customElement('about-ctrl-element')
export class AboutElement extends LitElement {
  static get styles(): CSSResult[] {
    return [
      css`
        :host {
          display: block;
          border: 1px inset #555;
          padding: 4px;
          margin: 2px 5px;
          background-color: #adff2f;
          text-align: right;
          border-radius: 4px;
          opacity: 0.9;
          user-select: none;
          float: right;
          clear: both;
        }
        .form-fields {
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: flex-start;
          text-align: left;
          margin: 1rem;
          min-width: 200px;
        }
        .form-fields a {
          outline: none;
          color: inherit;
          font-weight: bold;
          text-decoration: none;
        }
      `,
    ];
  }

  render(): TemplateResult {
    return html`
      <link rel="stylesheet" href="https://kit-free.fontawesome.com/releases/latest/css/free.min.css" />
      <i class="fas fa-info-circle fa-2x" @click=${this.openDialog}></i>
      <ui5-dialog id="about-dialog" header-text="FlyXC.app">
        <section class="form-fields">
          <div>
            <ui5-label>FlyXC by Victor Berchet</ui5-label>
          </div>
          <br />
          <div>
            <ui5-label
              >Airspaces from
              <a href="http://www.openaip.net">openaip.net</a>
            </ui5-label>
          </div>
          <div>
            <ui5-label
              >Airways from
              <a href="https://thermal.kk7.ch">thermal.kk7.ch</a>
            </ui5-label>
          </div>
          <br />
          <div>
            <ui5-label>build <%BUILD%></ui5-label>
          </div>
          <br />
          <div>
            <ui5-label
              >Report issues on
              <a href="https://github.com/vicb/flyxc/issues">github <i class="fab fa-github-square fa-2x"></i></a
            ></ui5-label>
          </div>
        </section>
        <div slot="footer" style="display:flex;align-items:center;padding:.5rem">
          <div style="flex: 1"></div>
          <ui5-button design="Emphasized" @click=${this.closeDialog}>Close</ui5-button>
        </div>
      </ui5-dialog>
    `;
  }

  protected openDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('about-dialog');
    (dialog as any).open();
  }

  protected closeDialog(): void {
    const shadowRoot = this.shadowRoot as ShadowRoot;
    const dialog = shadowRoot.getElementById('about-dialog');
    (dialog as any).close();
  }
}
